'use client'

import { useState } from 'react'
import { Loader2, X, AlertTriangle } from 'lucide-react'

interface DeleteDialogProps {
  workflowId: string
  workflowName: string
  onClose: () => void
  onDeleted: (id: string) => void
}

export function DeleteDialog({ workflowId, workflowName, onClose, onDeleted }: DeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setIsDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      onDeleted(workflowId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[420px] rounded-2xl border border-[#2a2a2a] bg-[#161616] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-200">Delete Workflow</h2>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-xs text-zinc-400">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-zinc-300">{workflowName}</span>?
              This will also delete all run history. This action cannot be undone.
            </p>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300">
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
