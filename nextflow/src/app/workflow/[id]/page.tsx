'use client'

import { useEffect, useRef, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { useRealtimeRun } from '@trigger.dev/react-hooks'
import {
  ArrowLeft, History, Loader2, Play, Zap, Check, Pencil,
} from 'lucide-react'
import { useWorkflowStore } from '@/store/workflow-store'
import { useHistoryStore } from '@/store/history-store'
import { useLinkedInLog } from '@/hooks/useLinkedInLog'
import { Canvas } from './_components/Canvas'
import { HistoryPanel } from './_components/HistoryPanel'
import { cn } from '@/lib/utils'
import type { WorkflowRecord, WorkflowRunRecord, NodeRunRecord } from '@/lib/types'

// ── Realtime glow subscriber ─────────────────────────────────────────────────
function RealtimeSubscriber({
  triggerRunId,
  publicToken,
  workflowRunId,
}: {
  triggerRunId: string
  publicToken: string
  workflowRunId: string
}) {
  const { setExecuting, clearExecuting, updateNodeData } = useWorkflowStore()
  const { updateRun } = useHistoryStore()
  const { run } = useRealtimeRun(triggerRunId, { accessToken: publicToken })

  useEffect(() => {
    if (!run) return

    const activeStatuses = new Set(['QUEUED', 'DEQUEUED', 'WAITING', 'PENDING_VERSION', 'DELAYED'])
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
        .then(updateRun)
    }
  }, [run, workflowRunId, setExecuting, clearExecuting, updateNodeData, updateRun])

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
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => void save()}
          className="rounded-md bg-[#1e1e1e] px-2 py-1 text-sm font-semibold text-zinc-200 outline-none ring-1 ring-violet-500/50 w-48"
          maxLength={100}
        />
        <button onClick={() => void save()} className="text-emerald-400 hover:text-emerald-300">
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={startEdit}
      className="group flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-[#1e1e1e] transition-colors"
    >
      <span className="max-w-[220px] truncate text-sm font-semibold text-zinc-200">
        {name}
      </span>
      <Pencil className="h-3 w-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
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

  const { init, nodes, edges, workflowName } = useWorkflowStore()
  const [localName, setLocalName] = useState('')

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(true)
  const [isRunning, setIsRunning] = useState(false)

  const [activeRun, setActiveRun] = useState<{
    workflowRunId: string
    triggerRunId: string
    publicToken: string
  } | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstLoad = useRef(true)
  const { prependRun } = useHistoryStore()

  // Load workflow
  useEffect(() => {
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
  }, [workflowId, init, router])

  // Sync local name from store
  useEffect(() => { if (workflowName) setLocalName(workflowName) }, [workflowName])

  // Auto-save graph (debounced 1.5s)
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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d0d0d]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0d0d0d]">
      {activeRun && (
        <RealtimeSubscriber
          triggerRunId={activeRun.triggerRunId}
          publicToken={activeRun.publicToken}
          workflowRunId={activeRun.workflowRunId}
        />
      )}

      {/* ── Top header — Galaxy.ai style ── */}
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#1e1e1e] bg-[#0d0d0d] px-4">
        {/* Left: back + logo + workflow name */}
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-[#1a1a1a] hover:text-zinc-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600">
            <Zap className="h-3.5 w-3.5 text-white" />
          </div>

          <div className="h-4 w-px bg-[#2a2a2a]" />

          <WorkflowNameEditor
            workflowId={workflowId}
            name={localName}
            onSaved={(n) => {
              setLocalName(n)
              useWorkflowStore.setState({ workflowName: n })
            }}
          />

          {isSaving && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-600">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              Saving
            </span>
          )}
        </div>

        {/* Right: history toggle + run button + user */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              showHistory
                ? 'bg-[#1e1e1e] text-zinc-300'
                : 'text-zinc-500 hover:bg-[#1a1a1a] hover:text-zinc-400',
            )}
          >
            <History className="h-3.5 w-3.5" />
            History
          </button>

          <button
            onClick={() => void handleRun()}
            disabled={isRunning}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition-all',
              isRunning
                ? 'bg-violet-700/60 text-violet-300 cursor-not-allowed'
                : 'bg-violet-600 text-white shadow-[0_0_16px_rgba(124,58,237,0.4)] hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(124,58,237,0.6)]',
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

          <div className="h-5 w-px bg-[#2a2a2a]" />
          <UserButton />
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        <Canvas
          workflowId={workflowId}
          isSaving={isSaving}
        />
        {showHistory && (
          <HistoryPanel
            workflowId={workflowId}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>
    </div>
  )
}
