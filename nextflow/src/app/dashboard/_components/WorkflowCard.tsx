'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, ArrowRight, Pencil, Trash2 } from 'lucide-react'
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
    success: 'bg-emerald-500',
    failed:  'bg-red-500',
    partial: 'bg-amber-500',
    running: 'bg-blue-500 animate-pulse',
  }
  return <span className={cn('inline-block h-2 w-2 rounded-full', map[status])} />
}

function StatusLabel({ status }: { status?: RunStatus | null }) {
  if (!status) return null
  const map: Record<RunStatus, string> = {
    success: 'text-emerald-600',
    failed:  'text-red-600',
    partial: 'text-amber-600',
    running: 'text-blue-600',
  }
  return (
    <span className={cn('text-xs capitalize', map[status])}>
      {status}
    </span>
  )
}

export function WorkflowCard({
  id, name, updatedAt, lastRunStatus, onRename, onDelete,
}: WorkflowCardProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="group relative flex items-center gap-4 rounded-xl border border-[#e8e8e8] bg-white px-5 py-4 transition-all hover:border-violet-200 hover:shadow-sm">

      {/* Left: icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50">
        <div className="h-4 w-4 rounded bg-violet-400/70" />
      </div>

      {/* Middle: name + meta */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#111111]">{name}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-xs text-[#aaaaaa]">
            {formatTimestamp(updatedAt)}
          </span>
          {lastRunStatus && (
            <>
              <span className="text-[#cccccc]">·</span>
              <div className="flex items-center gap-1.5">
                <StatusDot status={lastRunStatus} />
                <StatusLabel status={lastRunStatus} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Open button — visible on hover */}
        <button
          onClick={() => router.push(`/workflow/${id}`)}
          className="flex items-center gap-1.5 rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-1.5 text-xs font-medium text-[#555555] opacity-0 transition-all group-hover:opacity-100 hover:border-violet-200 hover:text-violet-600"
        >
          Open
          <ArrowRight className="h-3 w-3" />
        </button>

        {/* 3-dot menu */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#aaaaaa] transition-colors hover:bg-[#f0f0f0] hover:text-[#555555]"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-36 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white shadow-lg">
                <button
                  onClick={() => { setMenuOpen(false); router.push(`/workflow/${id}`) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#555555] hover:bg-[#f8f8f8] hover:text-[#111111]"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Open
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onRename(id, name) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#555555] hover:bg-[#f8f8f8] hover:text-[#111111]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Rename
                </button>
                <div className="mx-2 h-px bg-[#f0f0f0]" />
                <button
                  onClick={() => { setMenuOpen(false); onDelete(id, name) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50"
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
