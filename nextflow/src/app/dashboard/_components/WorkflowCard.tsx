'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, ArrowRight, Pencil, Trash2, Loader2 } from 'lucide-react'
import { formatTimestamp } from '@/lib/utils'
import { cn } from '@/lib/utils'

type RunStatus = 'running' | 'success' | 'failed' | 'partial'

interface WorkflowCardProps {
  id: string
  name: string
  updatedAt: string
  lastRunStatus?: RunStatus | null
  onRename: (id: string, currentName: string) => void
  onDelete: (id: string, name: string) => void
}

function StatusDot({ status }: { status?: RunStatus | null }) {
  if (!status) return null
  const map: Record<RunStatus, string> = {
    success: 'bg-emerald-400',
    failed:  'bg-red-400',
    partial: 'bg-amber-400',
    running: 'bg-blue-400 animate-pulse',
  }
  return <span className={cn('inline-block h-2 w-2 rounded-full', map[status])} />
}

export function WorkflowCard({
  id, name, updatedAt, lastRunStatus, onRename, onDelete,
}: WorkflowCardProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="group relative flex items-center gap-4 rounded-xl border border-[#2a2a2a] bg-[#161616] px-5 py-4 transition-colors hover:border-violet-500/30 hover:bg-[#1a1a1a]">
      {/* Left: icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600/10">
        <div className="h-4 w-4 rounded bg-violet-500/60" />
      </div>

      {/* Middle: name + meta */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-200">{name}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-xs text-zinc-600">
            {formatTimestamp(updatedAt)}
          </span>
          {lastRunStatus && (
            <>
              <span className="text-zinc-700">·</span>
              <div className="flex items-center gap-1.5">
                <StatusDot status={lastRunStatus} />
                <span className="text-xs capitalize text-zinc-600">{lastRunStatus}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Open button — always visible on hover */}
        <button
          onClick={() => router.push(`/workflow/${id}`)}
          className="flex items-center gap-1.5 rounded-lg border border-[#2a2a2a] px-3 py-1.5 text-xs font-medium text-zinc-400 opacity-0 transition-all group-hover:opacity-100 hover:border-violet-500/40 hover:text-violet-400"
        >
          Open
          <ArrowRight className="h-3 w-3" />
        </button>

        {/* 3-dot menu */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-[#222] hover:text-zinc-400"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-36 overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] shadow-xl">
                <button
                  onClick={() => { setMenuOpen(false); router.push(`/workflow/${id}`) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-400 hover:bg-[#222] hover:text-zinc-300"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Open
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onRename(id, name) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-400 hover:bg-[#222] hover:text-zinc-300"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Rename
                </button>
                <div className="mx-2 h-px bg-[#2a2a2a]" />
                <button
                  onClick={() => { setMenuOpen(false); onDelete(id, name) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-400 hover:bg-red-400/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
