/**
 * Uploads a file to /api/upload and returns the permanent URL.
 * Shows a local blob preview immediately while the upload is in progress,
 * then swaps to the permanent URL once complete.
 *
 * Usage:
 *   const url = await uploadImage(file)
 */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const err = await res.json() as { error?: string }
    throw new Error(err.error ?? 'Upload failed')
  }

  const { url } = await res.json() as { url: string }
  return url
}
