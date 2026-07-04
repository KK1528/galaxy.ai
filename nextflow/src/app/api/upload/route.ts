import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/upload
 * Accepts a multipart form with a single "file" field (image).
 *
 * Returns { url } — a base64 data URL.
 * This is intentional: Gemini's API accepts base64 inline data directly,
 * so we don't need an external storage service for vision inputs.
 * The crop-image Trigger.dev task uses Transloadit separately via /http/import.
 */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }

  // Size guard — 10 MB max
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const dataUrl = `data:${file.type};base64,${base64}`

  return NextResponse.json({ url: dataUrl })
}
