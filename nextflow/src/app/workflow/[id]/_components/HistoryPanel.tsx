'use client'

import { useEffect } from 'react'
import { Clock, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertCircle, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration, formatTimestamp } from '@/lib/utils'
import { useHistoryStore } from '@/store/history-store'
import type { WorkflowRunRecord, NodeRunRecord, RunStatus, NodeRunStatus } from '@/lib/types'

function StatusBadge({ status }: { status: RunStatus | NodeRunStatus }) {
  const map: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    success:  { icon: <CheckCircle2 className="h-3 w-3" />, color: 'text-emerald-400', label: 'Success' },
    failed:   { icon: <XCircle className="h-3 w-3" />,      color: 'text-red-400',     label: 'Failed'  },
    partial:  { icon: <AlertCircle className="h-3 w-3" />,  color: 'text-amber-400',   label: 'Partial' },
    running:  { icon: <Loader2 className="h-3 w-3 animate-spin" />, color: 'text-blue-400', label: 'Running' },
    pending:  { icon: <Clock className="h-3 w-3" />,        color: 'text-zinc-500',    label: 'Pending' },
  }
  const s = map[status] ?? map['pending']
  return (
    <span className={cn('flex items-center gap-1 text-[11px] font-medium', s.color)}>
      {s.icon}
      {s.label}
    </span>
  )
}

function NodeRunRow({ nodeRun }: { nodeRun: NodeRunRecord }) {
  return (
    <div className="flex items-start gap-2 py-1.5 pl-4 pr-2">
      <div className="mt-0.5 shrink-0">
        <StatusBadge status={nodeRun.status} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-zinc-300">{nodeRun.nodeLabel}</p>
        {nodeRun.duration !== null && (
          <p className="text-[10px] text-zinc-600">{formatDuration(nodeRun.duration)}</p>
        )}
        {nodeRun.output && (
          <p className="mt-0.5 truncate text-[10px] text-zinc-500">
            {nodeRun.nodeType === 'crop-image'
              ? (nodeRun.output as { outputUrl?: string }).outputUrl ?? '—'
              : ((nodeRun.output as { response?: string }).response?.slice(0, 60) ?? '') + '...'}
          </p>
        )}
        {nodeRun.error && (
          <p className="mt-0.5 truncate text-[10px] text-red-400">{nodeRun.error}</p>
        )}
      </div>
    </div>
  )
}

function RunRow({ run, index }: { run: WorkflowRunRecord; index: number }) {
  const { expandedRunId, toggleExpand } = useHistoryStore()
  const isExpanded = expandedRunId === run.id

  const totalDuration = run.finishedAt
    ? (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000
    : null

  return (
    <div className="border-b border-[#1e1e1e]">
      <button
        onClick={() => toggleExpand(run.id)}
        className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-[#1a1a1a] transition-colors text-left"
      >
        {isExpanded
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-zinc-400">
              Run #{index + 1}
            </span>
            <span className="rounded bg-[#2a2a2a] px-1.5 py-0.5 text-[9px] uppercase text-zinc-600">
              {run.scope}
            </span>
          </div>
          <p className="text-[10px] text-zinc-600">{formatTimestamp(run.startedAt)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <StatusBadge status={run.status} />
          {totalDuration !== null && (
            <span className="text-[10px] text-zinc-600">{formatDuration(totalDuration)}</span>
          )}
        </div>
      </button>

      {isExpanded && run.nodeRuns.length > 0 && (
        <div className="border-t border-[#1e1e1e] bg-[#111] divide-y divide-[#1a1a1a]">
          {run.nodeRuns.map((nr) => (
            <NodeRunRow key={nr.id} nodeRun={nr} />
          ))}
        </div>
      )}
    </div>
  )
}

interface HistoryPanelProps {
  workflowId: string
  onClose?: () => void
}

export function HistoryPanel({ workflowId, onClose }: HistoryPanelProps) {
  const { runs, isLoading, setRuns, setLoading, setError } = useHistoryStore()

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/workflows/${workflowId}/runs`)
        if (!res.ok) throw new Error('Failed to load history')
        const data = await res.json() as WorkflowRunRecord[]
        if (!cancelled) setRuns(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    // Poll every 5s while any run is still running
    const interval = setInterval(() => {
      const hasRunning = runs.some((r) => r.status === 'running')
      if (hasRunning) void load()
    }, 5000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId])

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l border-[#2a2a2a] bg-[#111]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[#2a2a2a] px-3 py-3">
        <Clock className="h-4 w-4 text-zinc-500" />
        <span className="text-sm font-semibold text-zinc-300">History</span>
        {onClose && (
          <button onClick={onClose} className="ml-auto text-zinc-600 hover:text-zinc-400">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Run list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && runs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <Clock className="h-8 w-8 text-zinc-700" />
            <p className="text-xs text-zinc-600">No runs yet</p>
          </div>
        ) : (
          runs.map((run, i) => (
            <RunRow key={run.id} run={run} index={runs.length - 1 - i} />
          ))
        )}
      </div>
    </div>
  )
}
