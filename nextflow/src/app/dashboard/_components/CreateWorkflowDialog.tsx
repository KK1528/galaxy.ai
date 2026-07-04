'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'

interface CreateWorkflowDialogProps {
  onClose: () => void
}

export function CreateWorkflowDialog({ onClose }: CreateWorkflowDialogProps) {
  const router = useRouter()
  const [name, setName] = useState('Untitled Workflow')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setIsCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) throw new Error('Failed to create workflow')
      const wf = await res.json() as { id: string }
      router.push(`/workflow/${wf.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="w-[420px] rounded-2xl border border-[#e8e8e8] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e8e8e8] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#111111]">New Workflow</h2>
          <button onClick={onClose} className="text-[#aaaaaa] hover:text-[#555555] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#777777]">
              Workflow name
            </label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] px-3 py-2 text-sm text-[#111111] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
              placeholder="My Workflow"
              maxLength={100}
            />
            {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-[#777777] hover:text-[#333333] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
            >
              {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Create Workflow
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
