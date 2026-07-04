import { task, metadata, AbortTaskRunError } from '@trigger.dev/sdk'
import { GoogleGenerativeAI, type Part } from '@google/generative-ai'
import { prisma } from '@/lib/prisma'

export interface GeminiPayload {
  prompt: string
  systemPrompt?: string
  imageUrls?: string[]
  model?: string
  runId: string
  nodeRunId: string
}

export const geminiTask = task({
  id: 'gemini',
  maxDuration: 120,
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 60_000,  // 60s — respects the typical 429 retry-after
    maxTimeoutInMs: 120_000,
    factor: 2,
  },

  run: async (payload: GeminiPayload) => {
    const {
      prompt,
      systemPrompt,
      imageUrls = [],
      model = 'gemini-2.0-flash',
      nodeRunId,
    } = payload

    // ── Mark node as running ─────────────────────────────────────────
    await prisma.nodeRun.update({
      where: { id: nodeRunId },
      data: { status: 'running', startedAt: new Date() },
    })
    await metadata.set('status', 'running')
    await metadata.set('nodeRunId', nodeRunId)

    // ── Build Gemini request ──────────────────────────────────────────
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

    const geminiModel = genAI.getGenerativeModel({
      model,
      ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
    })

    // Build multimodal parts array
    const parts: Part[] = []

    // Fetch and inline any image URLs as base64
    for (const url of imageUrls) {
      try {
        const res = await fetch(url)
        const arrayBuffer = await res.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        const mimeType = (res.headers.get('content-type') ?? 'image/jpeg') as
          | 'image/jpeg'
          | 'image/png'
          | 'image/webp'
          | 'image/gif'
        parts.push({ inlineData: { data: base64, mimeType } })
      } catch (err) {
        console.warn(`[gemini] Could not fetch image ${url}:`, err)
      }
    }

    // Text prompt goes last
    parts.push({ text: prompt })

    // ── Call Gemini ───────────────────────────────────────────────────
    let result
    try {
      result = await geminiModel.generateContent({ contents: [{ role: 'user', parts }] })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // Daily quota exhaustion (limit: 0) cannot be recovered by retrying —
      // abort immediately so we don't waste further quota attempts.
      if (message.includes('limit: 0') && message.includes('PerDay')) {
        throw new AbortTaskRunError(
          'Google AI daily quota exhausted. Please enable billing at https://aistudio.google.com or wait until midnight PT for the quota to reset.',
        )
      }
      throw err
    }
    const response = result.response.text()

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
        output: { response },
        finishedAt,
        duration,
      },
    })
    await metadata.set('status', 'success')

    return { response }
  },
})
