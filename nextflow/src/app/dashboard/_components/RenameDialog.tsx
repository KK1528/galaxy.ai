'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, X } from 'lucide-react'

interface RenameDialogProps {
  workflowId: string
  currentName: string
  onClose: () => void
  onRenamed: (id: string, newName: string) => void
}

export function RenameDialog({ workflowId, currentName, onClose, onRenamed }: RenameDialogProps) {
  const [name, setName] = useState(currentName)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || name.trim() === currentName) { onClose(); return }
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) throw new Error('Failed to rename')
      onRenamed(workflowId, name.trim())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="w-[420px] rounded-2xl border border-[#e8e8e8] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e8e8e8] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#111111]">Rename Workflow</h2>
          <button onClick={onClose} className="text-[#aaaaaa] hover:text-[#555555] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] px-3 py-2 text-sm text-[#111111] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
            maxLength={100}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}

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
              disabled={isSaving || !name.trim()}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
