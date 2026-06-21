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

    // ── MANDATORY: 30+ second artificial delay ────────────────────────
    await new Promise((resolve) => setTimeout(resolve, 31_000))

    // ── Transloadit FFmpeg crop assembly ─────────────────────────────
    const TRANSLOADIT_KEY = process.env.TRANSLOADIT_KEY!
    const TRANSLOADIT_SECRET = process.env.TRANSLOADIT_SECRET!

    if (!TRANSLOADIT_KEY || !TRANSLOADIT_SECRET) {
      throw new Error('Transloadit credentials not configured')
    }

    // Build the Transloadit assembly params
    const params = {
      auth: { key: TRANSLOADIT_KEY },
      steps: {
        ':original': {
          robot: '/http/import',
          url: imageUrl,
        },
        cropped: {
          robot: '/image/resize',
          use: ':original',
          // Transloadit crop uses gravity + width/height offsets
          // Convert percentage coords to the robot's crop params
          // We'll use /image/resize with crop gravity
          gravity: 'NorthWest',
          crop: {
            x1: `${x}p`,
            y1: `${y}p`,
            x2: `${x + width}p`,
            y2: `${y + height}p`,
          },
          imagemagick_stack: 'v3.0.0',
        },
        exported: {
          robot: '/s3/store',
          use: 'cropped',
          credentials: 'nextflow_s3',
        },
      },
    }

    // POST assembly to Transloadit
    const formData = new FormData()
    formData.append('params', JSON.stringify(params))

    // Create HMAC-SHA256 signature
    const encoder = new TextEncoder()
    const keyData = encoder.encode(TRANSLOADIT_SECRET)
    const msgData = encoder.encode(JSON.stringify(params))
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
    const sigHex = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    formData.append('signature', `sha256:${sigHex}`)

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

    const outputUrl = result.results?.['exported']?.[0]?.ssl_url
      ?? result.results?.['cropped']?.[0]?.ssl_url

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
