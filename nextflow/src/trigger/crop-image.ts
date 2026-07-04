import { task, metadata } from '@trigger.dev/sdk'
import { prisma } from '@/lib/prisma'

export interface CropImagePayload {
  imageUrl: string
  x: number
  y: number
  width: number
  height: number
  runId: string
  nodeRunId: string
}

export const cropImageTask = task({
  id: 'crop-image',
  maxDuration: 300,

  run: async (payload: CropImagePayload) => {
    const { imageUrl, x, y, width, height, runId, nodeRunId } = payload

    // ── Mark node as running ─────────────────────────────────────────
    await prisma.nodeRun.update({
      where: { id: nodeRunId },
      data: { status: 'running', startedAt: new Date() },
    })
    await metadata.set('status', 'running')
    await metadata.set('nodeRunId', nodeRunId)

    // ── Transloadit FFmpeg crop assembly ─────────────────────────────
    const TRANSLOADIT_KEY = process.env.TRANSLOADIT_KEY!
    const TRANSLOADIT_SECRET = process.env.TRANSLOADIT_SECRET!

    if (!TRANSLOADIT_KEY || !TRANSLOADIT_SECRET) {
      throw new Error('Transloadit credentials not configured')
    }

    // Build the Transloadit assembly params
    // Transloadit requires auth.expires in format: "YYYY/MM/DD HH:MM:SS+00:00"
    const exp = new Date(Date.now() + 60 * 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const expires = `${exp.getUTCFullYear()}/${pad(exp.getUTCMonth() + 1)}/${pad(exp.getUTCDate())} ${pad(exp.getUTCHours())}:${pad(exp.getUTCMinutes())}:${pad(exp.getUTCSeconds())}+00:00`

    // Determine if the imageUrl is a base64 data URL or a regular HTTP URL.
    // Transloadit's /http/import robot cannot fetch data: URLs — when we have
    // a base64 data URL we must upload the raw bytes directly as a file field.
    const isDataUrl = imageUrl.startsWith('data:')

    const params = {
      auth: {
        key: TRANSLOADIT_KEY,
        expires,
      },
      steps: {
        // Use :original (upload handle) when uploading directly,
        // or a named http_import step when fetching from a URL.
        ...(isDataUrl
          ? {}
          : {
              http_import: {
                robot: '/http/import',
                url: imageUrl,
              },
            }),
        cropped: {
          robot: '/image/resize',
          use: isDataUrl ? ':original' : 'http_import',
          gravity: 'top-left',
          crop: {
            x1: `${x}p`,
            y1: `${y}p`,
            x2: `${x + width}p`,
            y2: `${y + height}p`,
          },
          imagemagick_stack: 'v3.0.0',
          result: true,
        },
      },
    }

    // Serialize ONCE — same string used for signing and sending
    const paramsStr = JSON.stringify(params)

    // POST assembly to Transloadit
    const formData = new FormData()
    formData.append('params', paramsStr)

    // If the image is a base64 data URL, decode it and attach as a file.
    // Transloadit will treat it as the :original upload.
    if (isDataUrl) {
      const [meta, b64] = imageUrl.split(',')
      const mimeType = meta.split(':')[1].split(';')[0]
      const ext = mimeType.split('/')[1] ?? 'jpg'
      const binaryStr = atob(b64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
      formData.append('file', new Blob([bytes], { type: mimeType }), `image.${ext}`)
    }

    // HMAC-SHA384 signature (Transloadit requires sha384 for newer accounts)
    const encoder = new TextEncoder()
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(TRANSLOADIT_SECRET),
      { name: 'HMAC', hash: 'SHA-384' },
      false,
      ['sign'],
    )
    const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(paramsStr))
    const sigHex = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    formData.append('signature', `sha384:${sigHex}`)

    const assemblyRes = await fetch('https://api2.transloadit.com/assemblies', {
      method: 'POST',
      body: formData,
    })

    if (!assemblyRes.ok) {
      const err = await assemblyRes.text()
      throw new Error(`Transloadit assembly failed: ${err}`)
    }

    const assembly = await assemblyRes.json() as {
      assembly_id: string
      assembly_ssl_url: string
      ok?: string
      error?: string
      results?: Record<string, Array<{ ssl_url: string }>>
    }

    // ── Poll assembly until complete ──────────────────────────────────
    let pollUrl = assembly.assembly_ssl_url
    let result = assembly

    while (result.ok !== 'ASSEMBLY_COMPLETED' && result.ok !== 'ASSEMBLY_FAILED') {
      await new Promise((r) => setTimeout(r, 2000))
      const pollRes = await fetch(pollUrl)
      result = await pollRes.json() as typeof assembly
    }

    if (result.ok === 'ASSEMBLY_FAILED' || result.error) {
      throw new Error(`Transloadit assembly error: ${result.error}`)
    }

    const outputUrl = result.results?.['cropped']?.[0]?.ssl_url

    if (!outputUrl) {
      throw new Error('Transloadit did not return an output URL')
    }

    // ── Update node run to success ────────────────────────────────────
    const finishedAt = new Date()
    const nodeRun = await prisma.nodeRun.findUnique({ where: { id: nodeRunId } })
    const duration = nodeRun?.startedAt
      ? (finishedAt.getTime() - nodeRun.startedAt.getTime()) / 1000
      : null

    await prisma.nodeRun.update({
      where: { id: nodeRunId },
      data: {
        status: 'success',
        output: { outputUrl },
        finishedAt,
        duration,
      },
    })
    await metadata.set('status', 'success')

    return { outputUrl }
  },
})
