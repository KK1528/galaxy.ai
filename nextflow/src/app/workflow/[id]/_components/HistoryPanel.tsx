'use client'

import { useEffect, useState } from 'react'
import {
  Clock, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, AlertCircle, Loader2, X, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration, formatTimestamp } from '@/lib/utils'
import { useHistoryStore } from '@/store/history-store'
import type { WorkflowRunRecord, NodeRunRecord, RunStatus, NodeRunStatus } from '@/lib/types'

type RunTab = 'ui' | 'api'
type RunFilter = 'All' | 'Success' | 'Failed' | 'Running'

function StatusBadge({ status }: { status: RunStatus | NodeRunStatus }) {
  const map: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    success: { icon: <CheckCircle2 className="h-3 w-3" />, color: 'text-emerald-600', label: 'Success' },
    failed:  { icon: <XCircle className="h-3 w-3" />,      color: 'text-red-500',     label: 'Failed'  },
    partial: { icon: <AlertCircle className="h-3 w-3" />,  color: 'text-amber-500',   label: 'Partial' },
    running: { icon: <Loader2 className="h-3 w-3 animate-spin" />, color: 'text-blue-600', label: 'Running' },
    pending: { icon: <Clock className="h-3 w-3" />,        color: 'text-[#aaaaaa]',   label: 'Pending' },
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
        <p className="truncate text-[11px] font-medium text-[#333333]">{nodeRun.nodeLabel}</p>
        {nodeRun.duration !== null && (
          <p className="text-[10px] text-[#aaaaaa]">{formatDuration(nodeRun.duration)}</p>
        )}
        {nodeRun.output && (
          <p className="mt-0.5 truncate text-[10px] text-[#888888]">
            {nodeRun.nodeType === 'crop-image'
              ? (nodeRun.output as { outputUrl?: string }).outputUrl ?? '—'
              : ((nodeRun.output as { response?: string }).response?.slice(0, 60) ?? '') + '...'}
          </p>
        )}
        {nodeRun.error && (
          <p className="mt-0.5 truncate text-[10px] text-red-500">{nodeRun.error}</p>
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
    <div className="border-b border-[#f0f0f0]">
      <button
        onClick={() => toggleExpand(run.id)}
        className="flex w-full items-center gap-2 px-4 py-3 hover:bg-[#fafafa] transition-colors text-left"
      >
        {isExpanded
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#bbbbbb]" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#bbbbbb]" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#333333]">Run #{index + 1}</span>
            <span className="rounded bg-[#f0f0f0] px-1.5 py-0.5 text-[9px] uppercase text-[#999999]">
              {run.scope}
            </span>
          </div>
          <p className="text-[10px] text-[#aaaaaa] mt-0.5">{formatTimestamp(run.startedAt)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <StatusBadge status={run.status} />
          {totalDuration !== null && (
            <span className="text-[10px] text-[#aaaaaa]">{formatDuration(totalDuration)}</span>
          )}
        </div>
      </button>

      {isExpanded && run.nodeRuns.length > 0 && (
        <div className="border-t border-[#f0f0f0] bg-[#fafafa] divide-y divide-[#f0f0f0]">
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
  const { runs, isLoading, setRuns, setLoading, setError, reset } = useHistoryStore()
  const [activeTab, setActiveTab] = useState<RunTab>('ui')
  const [filter, setFilter] = useState<RunFilter>('All')
  const [showFilterMenu, setShowFilterMenu] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/workflows/${workflowId}/runs`)
      if (!res.ok) throw new Error('Failed to load history')
      const data = await res.json() as WorkflowRunRecord[]
      setRuns(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reset()
    let cancelled = false
    async function loadWithCancel() {
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
    void loadWithCancel()
    const interval = setInterval(() => {
      const hasRunning = runs.some((r) => r.status === 'running')
      if (hasRunning) void loadWithCancel()
    }, 5000)
    return () => { cancelled = true; clearInterval(interval) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId])

  const filteredRuns = runs.filter((r) => {
    if (filter === 'All') return true
    return r.status === filter.toLowerCase()
  })

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-[#e8e8e8] bg-white">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#f0f0f0]">
        <span className="text-sm font-semibold text-[#1a1a2e]">Execution History</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => void load()}
            title="Refresh"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#aaaaaa] hover:bg-[#f5f5f5] hover:text-[#555555] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-sm text-[#777777] hover:text-[#333333] transition-colors px-1"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* UI Runs / API Runs tabs */}
      <div className="flex gap-1 px-3 pt-3 pb-2">
        <button
          onClick={() => setActiveTab('ui')}
          className={cn(
            'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
            activeTab === 'ui'
              ? 'bg-[#f0f0f0] text-[#1a1a2e]'
              : 'text-[#aaaaaa] hover:text-[#555555]',
          )}
        >
          UI Runs
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={cn(
            'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
            activeTab === 'api'
              ? 'bg-[#f0f0f0] text-[#1a1a2e]'
              : 'text-[#aaaaaa] hover:text-[#555555]',
          )}
        >
          API Runs
        </button>
      </div>

      {/* Run history + filter row */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#f0f0f0]">
        <span className="text-xs font-medium text-[#555555]">Run history</span>
        <div className="relative">
          <button
            onClick={() => setShowFilterMenu((v) => !v)}
            className="flex items-center gap-1 text-xs text-[#555555] hover:text-[#1a1a2e] transition-colors"
          >
            {filter}
            <ChevronDown className="h-3 w-3" />
          </button>
          {showFilterMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowFilterMenu(false)} />
              <div className="absolute right-0 top-6 z-20 w-28 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white shadow-lg">
                {(['All', 'Success', 'Failed', 'Running'] as RunFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setFilter(f); setShowFilterMenu(false) }}
                    className={cn(
                      'flex w-full items-center px-3 py-2 text-left text-xs transition-colors',
                      filter === f
                        ? 'bg-violet-50 text-violet-700 font-medium'
                        : 'text-[#555555] hover:bg-[#f8f8f8]',
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Run list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && filteredRuns.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-[#cccccc]" />
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 px-4 text-center">
            <p className="text-xs text-[#aaaaaa]">No runs for this filter yet.</p>
          </div>
        ) : (
          filteredRuns.map((run, i) => (
            <RunRow key={run.id} run={run} index={filteredRuns.length - 1 - i} />
          ))
        )}
      </div>
    </div>
  )
}
