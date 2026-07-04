'use client'

import { useEffect, useState } from 'react'
import {
  Loader2, Zap, Search, LayoutGrid, List, Plus,
} from 'lucide-react'
import { useLinkedInLog } from '@/hooks/useLinkedInLog'
import { AppSidebar } from '@/components/AppSidebar'
import { WorkflowCard } from './_components/WorkflowCard'
import { CreateWorkflowDialog } from './_components/CreateWorkflowDialog'
import { RenameDialog } from './_components/RenameDialog'
import { DeleteDialog } from './_components/DeleteDialog'
import { cn } from '@/lib/utils'

type RunStatus = 'running' | 'success' | 'failed' | 'partial'

interface WorkflowItem {
  id: string
  name: string
  updatedAt: string
  runs: Array<{ status: string }>
}

type DialogState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'rename'; id: string; name: string }
  | { type: 'delete'; id: string; name: string }

export default function DashboardPage() {
  useLinkedInLog()

  const [workflows, setWorkflows] = useState<WorkflowItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' })
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  useEffect(() => {
    void loadWorkflows()
  }, [])

  async function loadWorkflows() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/workflows')
      if (res.ok) {
        const data = await res.json() as WorkflowItem[]
        setWorkflows(data)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const filtered = workflows.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()),
  )

  function handleRenamed(id: string, newName: string) {
    setWorkflows((ws) => ws.map((w) => w.id === id ? { ...w, name: newName } : w))
  }

  function handleDeleted(id: string) {
    setWorkflows((ws) => ws.filter((w) => w.id !== id))
  }

  return (
    <div className="flex h-screen bg-[#f5f5f5] text-[#111111]">

      <AppSidebar
        activeItem="workflows"
        onNewWorkflow={() => setDialog({ type: 'create' })}
      />

      {/* ── Main ── */}
      <main className="flex flex-1 flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-4 border-b border-[#e8e8e8] bg-white px-6 py-4">
          <h1 className="text-base font-bold text-[#111111]">Workflows</h1>

          <div className="ml-auto flex items-center gap-3">

            {/* Search */}
            <div className="flex items-center gap-2 rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-[#aaaaaa]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search workflows..."
                className="w-44 bg-transparent text-xs text-[#333333] outline-none placeholder:text-[#aaaaaa]"
              />
            </div>

            {/* View toggle */}
            <div className="flex rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  viewMode === 'list'
                    ? 'bg-white text-[#333333] shadow-sm'
                    : 'text-[#aaaaaa] hover:text-[#666666]',
                )}
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  viewMode === 'grid'
                    ? 'bg-white text-[#333333] shadow-sm'
                    : 'text-[#aaaaaa] hover:text-[#666666]',
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Create */}
            <button
              onClick={() => setDialog({ type: 'create' })}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" />
              New Workflow
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-[#cccccc]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
                <Zap className="h-8 w-8 text-violet-400" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-[#555555]">
                  {search ? 'No workflows found' : 'No workflows yet'}
                </p>
                <p className="mt-1 text-sm text-[#aaaaaa]">
                  {search
                    ? 'Try a different search term'
                    : 'Create your first workflow to get started'}
                </p>
              </div>
              {!search && (
                <button
                  onClick={() => setDialog({ type: 'create' })}
                  className="flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
                >
                  <Plus className="h-4 w-4" />
                  Create Workflow
                </button>
              )}
            </div>
          ) : (
            <div className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'
                : 'flex flex-col gap-2',
            )}>
              {filtered.map((wf) => (
                <WorkflowCard
                  key={wf.id}
                  id={wf.id}
                  name={wf.name}
                  updatedAt={wf.updatedAt}
                  lastRunStatus={wf.runs[0]?.status as RunStatus | undefined}
                  onRename={(id, name) => setDialog({ type: 'rename', id, name })}
                  onDelete={(id, name) => setDialog({ type: 'delete', id, name })}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Dialogs */}
      {dialog.type === 'create' && (
        <CreateWorkflowDialog onClose={() => setDialog({ type: 'none' })} />
      )}
      {dialog.type === 'rename' && (
        <RenameDialog
          workflowId={dialog.id}
          currentName={dialog.name}
          onClose={() => setDialog({ type: 'none' })}
          onRenamed={handleRenamed}
        />
      )}
      {dialog.type === 'delete' && (
        <DeleteDialog
          workflowId={dialog.id}
          workflowName={dialog.name}
          onClose={() => setDialog({ type: 'none' })}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
