import { task, metadata } from '@trigger.dev/sdk'
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

  run: async (payload: GeminiPayload) => {
    const {
      prompt,
      systemPrompt,
      imageUrls = [],
      model = 'gemini-1.5-pro',
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
    const result = await geminiModel.generateContent({ contents: [{ role: 'user', parts }] })
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
