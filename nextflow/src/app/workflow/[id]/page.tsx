'use client'

import { useEffect, useRef, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { useRealtimeRun } from '@trigger.dev/react-hooks'
import {
  ArrowLeft, Loader2, Play, Zap, Pencil, Clock,
} from 'lucide-react'
import { useWorkflowStore } from '@/store/workflow-store'
import { useHistoryStore } from '@/store/history-store'
import { useLinkedInLog } from '@/hooks/useLinkedInLog'
import { AppSidebar } from '@/components/AppSidebar'
import { Canvas } from './_components/Canvas'
import { HistoryPanel } from './_components/HistoryPanel'
import { cn } from '@/lib/utils'
import type { WorkflowRecord, WorkflowRunRecord, NodeRunRecord } from '@/lib/types'

// ── Realtime subscriber ───────────────────────────────────────────────────────
function RealtimeSubscriber({
  triggerRunId,
  publicToken,
  workflowRunId,
  onComplete,
}: {
  triggerRunId: string
  publicToken: string
  workflowRunId: string
  onComplete: () => void
}) {
  const { setExecuting, clearExecuting, updateNodeData } = useWorkflowStore()
  const { updateRun } = useHistoryStore()
  const { run } = useRealtimeRun(triggerRunId, { accessToken: publicToken })

  useEffect(() => {
    if (!run) return
    const activeStatuses = new Set(['QUEUED', 'DEQUEUED', 'WAITING', 'PENDING_VERSION', 'DELAYED', 'EXECUTING'])
    if (activeStatuses.has(run.status)) {
      void fetch(`/api/runs/${workflowRunId}`)
        .then((r) => r.json() as Promise<WorkflowRunRecord>)
        .then((data) => {
          for (const nr of data.nodeRuns as NodeRunRecord[]) {
            if (nr.status === 'running') {
              setExecuting(nr.nodeId, true)
            } else {
              setExecuting(nr.nodeId, false)
              if (nr.nodeType === 'gemini' && nr.status === 'success') {
                const output = nr.output as { response?: string } | null
                if (output?.response) {
                  updateNodeData(nr.nodeId, { response: output.response, isStreaming: false })
                }
              }
            }
          }
          updateRun(data)
        })
    }
    if (['COMPLETED', 'FAILED', 'CANCELED', 'CRASHED'].includes(run.status)) {
      clearExecuting()
      void fetch(`/api/runs/${workflowRunId}`)
        .then((r) => r.json() as Promise<WorkflowRunRecord>)
        .then((data) => {
          // Push final outputs onto canvas nodes
          for (const nr of data.nodeRuns as NodeRunRecord[]) {
            if (nr.status === 'success') {
              if (nr.nodeType === 'gemini') {
                const out = nr.output as { response?: string } | null
                if (out?.response) {
                  updateNodeData(nr.nodeId, { response: out.response, isStreaming: false })
                }
              }
              if (nr.nodeType === 'response') {
                const out = nr.output as { slots?: string } | null
                if (out?.slots) {
                  try {
                    const parsed = JSON.parse(out.slots) as Array<{ label: string; value: string }>
                    updateNodeData(nr.nodeId, { slots: parsed, result: parsed[0]?.value ?? null })
                  } catch {
                    updateNodeData(nr.nodeId, { result: out.slots })
                  }
                }
              }
            }
          }
          updateRun(data)
          onComplete()
        })
    }
  }, [run, workflowRunId, setExecuting, clearExecuting, updateNodeData, updateRun, onComplete])

  return null
}

// ── Inline editable workflow name ─────────────────────────────────────────────
function WorkflowNameEditor({
  workflowId,
  name,
  onSaved,
}: {
  workflowId: string
  name: string
  onSaved: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setValue(name) }, [name])

  function startEdit() {
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function save() {
    const trimmed = value.trim()
    if (!trimmed || trimmed === name) { setEditing(false); setValue(name); return }
    await fetch(`/api/workflows/${workflowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    onSaved(trimmed)
    setEditing(false)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') void save()
    if (e.key === 'Escape') { setEditing(false); setValue(name) }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => void save()}
        className="rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-sm font-semibold text-[#1a1a2e] outline-none ring-2 ring-violet-100 w-52 shadow-sm"
        maxLength={100}
      />
    )
  }

  return (
    <button
      onClick={startEdit}
      className="group flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm border border-[#e8e8e8] hover:border-[#d0d0d0] transition-colors"
    >
      <span className="max-w-[200px] truncate text-sm font-semibold text-[#1a1a2e]">
        {name}
      </span>
      <Pencil className="h-3 w-3 text-[#aaaaaa] opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
interface PageProps {
  params: Promise<{ id: string }>
}

export default function WorkflowPage({ params }: PageProps) {
  useLinkedInLog()
  const { id: workflowId } = use(params)
  const router = useRouter()

  const { init, nodes, edges, workflowName, setRunNodeCallback } = useWorkflowStore()
  const [localName, setLocalName] = useState('')

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [runningNodeId, setRunningNodeId] = useState<string | null>(null)

  const [activeRun, setActiveRun] = useState<{
    workflowRunId: string
    triggerRunId: string
    publicToken: string
  } | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstLoad = useRef(true)
  const { prependRun, reset: resetHistory } = useHistoryStore()

  useEffect(() => {
    resetHistory()
    async function load() {
      try {
        const res = await fetch(`/api/workflows/${workflowId}`)
        if (!res.ok) { router.push('/dashboard'); return }
        const wf = await res.json() as WorkflowRecord
        init(wf.id, wf.name, wf.graph.nodes, wf.graph.edges)
        setLocalName(wf.name)
      } catch {
        router.push('/dashboard')
      } finally {
        setIsLoading(false)
        isFirstLoad.current = false
      }
    }
    void load()
  }, [workflowId, init, router, resetHistory])

  useEffect(() => { if (workflowName) setLocalName(workflowName) }, [workflowName])

  useEffect(() => {
    if (isFirstLoad.current || isLoading) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setIsSaving(true)
      try {
        await fetch(`/api/workflows/${workflowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ graph: { nodes, edges } }),
        })
      } finally {
        setIsSaving(false)
      }
    }, 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  async function handleRun() {
    setIsRunning(true)
    try {
      const inputNode = nodes.find((n) => (n.data as { nodeType: string }).nodeType === 'request-inputs')
      const inputs: Record<string, string> = {}
      if (inputNode) {
        const fields = (inputNode.data as { fields: Array<{ id: string; value: string }> }).fields
        for (const f of fields) inputs[f.id] = f.value
      }
      const res = await fetch(`/api/workflows/${workflowId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'full', inputs }),
      })
      if (!res.ok) throw new Error('Failed to start run')
      const { runId, triggerRunId, publicToken } = await res.json() as {
        runId: string; triggerRunId: string; publicToken: string
      }
      setActiveRun({ workflowRunId: runId, triggerRunId, publicToken })
      prependRun({
        id: runId, workflowId, userId: '',
        status: 'running', scope: 'full',
        startedAt: new Date().toISOString(),
        finishedAt: null, nodeRuns: [],
      })
    } catch (err) {
      console.error('[WorkflowPage] run error', err)
    } finally {
      setIsRunning(false)
    }
  }

  // Single-node run — triggered by the Run button inside a node (e.g. Gemini)
  async function handleSingleNodeRun(nodeId: string) {
    if (runningNodeId) return  // prevent concurrent single runs
    setRunningNodeId(nodeId)
    try {
      const inputNode = nodes.find((n) => (n.data as { nodeType: string }).nodeType === 'request-inputs')
      const inputs: Record<string, string> = {}
      if (inputNode) {
        const fields = (inputNode.data as { fields: Array<{ id: string; value: string }> }).fields
        for (const f of fields) inputs[f.id] = f.value
      }
      const res = await fetch(`/api/workflows/${workflowId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'single', nodeIds: [nodeId], inputs }),
      })
      if (!res.ok) throw new Error('Failed to start node run')
      const { runId, triggerRunId, publicToken } = await res.json() as {
        runId: string; triggerRunId: string; publicToken: string
      }
      setActiveRun({ workflowRunId: runId, triggerRunId, publicToken })
      prependRun({
        id: runId, workflowId, userId: '',
        status: 'running', scope: 'single',
        startedAt: new Date().toISOString(),
        finishedAt: null, nodeRuns: [],
      })
    } catch (err) {
      console.error('[WorkflowPage] single node run error', err)
    } finally {
      setRunningNodeId(null)
    }
  }

  // Register the single-node run callback in the store so nodes can call it
  useEffect(() => {
    setRunNodeCallback(handleSingleNodeRun)
    return () => setRunNodeCallback(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId, nodes])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#eeeef0]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-[#cccccc]" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#eeeef0]">
      {activeRun && (
        <RealtimeSubscriber
          triggerRunId={activeRun.triggerRunId}
          publicToken={activeRun.publicToken}
          workflowRunId={activeRun.workflowRunId}
          onComplete={() => setActiveRun(null)}
        />
      )}

      {/* ── Shared sidebar ── */}
      <AppSidebar />

      {/* ── Right section: canvas + history panel side-by-side ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Canvas wrapper — relative so floating overlays work, shrinks when history opens */}
        <div className="relative h-full flex-1 overflow-hidden">

          {/* Floating workflow name pill — top left */}
          <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
            <Link
              href="/dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm border border-[#e8e8e8] text-[#555555] hover:border-[#d0d0d0] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <WorkflowNameEditor
              workflowId={workflowId}
              name={localName}
              onSaved={(n) => {
                setLocalName(n)
                useWorkflowStore.setState({ workflowName: n })
              }}
            />

            {isSaving && (
              <span className="flex items-center gap-1 rounded-lg bg-white/80 px-2 py-1 text-[10px] text-[#aaaaaa] shadow-sm">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Saving
              </span>
            )}
          </div>

          {/* Floating controls — top right */}
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            {/* History toggle */}
            <button
              onClick={() => setShowHistory((v) => !v)}
              title="Execution History"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-colors',
                showHistory
                  ? 'bg-white border-violet-200 text-violet-600'
                  : 'bg-white border-[#e8e8e8] text-[#888888] hover:border-[#d0d0d0] hover:text-[#555555]',
              )}
            >
              <Clock className="h-4 w-4" />
            </button>

            {/* Run */}
            <button
              onClick={() => void handleRun()}
              disabled={isRunning}
              className={cn(
                'flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm transition-all',
                isRunning
                  ? 'bg-violet-400 text-white cursor-not-allowed'
                  : 'bg-violet-600 text-white hover:bg-violet-500',
              )}
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Running
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-white" />
                  Run
                </>
              )}
            </button>

            {/* User */}
            <div className="flex h-9 w-9 items-center justify-center">
              <UserButton />
            </div>
          </div>

          {/* Canvas — fills the remaining space */}
          <Canvas workflowId={workflowId} isSaving={isSaving} />
        </div>

        {/* History panel — sits as a flex sibling, slides in/out with a width transition */}
        <div
          className={cn(
            'shrink-0 overflow-hidden border-l border-[#e8e8e8] bg-white transition-all duration-300 ease-in-out',
            showHistory ? 'w-80' : 'w-0',
          )}
        >
          {/* Only mount content when open to avoid unnecessary fetches */}
          {showHistory && (
            <HistoryPanel
              workflowId={workflowId}
              onClose={() => setShowHistory(false)}
            />
          )}
        </div>

      </div>
    </div>
  )
}
