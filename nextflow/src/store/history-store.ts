'use client'

import { create } from 'zustand'
import type { WorkflowRunRecord } from '@/lib/types'

interface HistoryState {
  runs: WorkflowRunRecord[]
  expandedRunId: string | null
  isLoading: boolean
  error: string | null

  setRuns: (runs: WorkflowRunRecord[]) => void
  prependRun: (run: WorkflowRunRecord) => void
  updateRun: (run: WorkflowRunRecord) => void
  toggleExpand: (runId: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useHistoryStore = create<HistoryState>((set) => ({
  runs: [],
  expandedRunId: null,
  isLoading: false,
  error: null,

  setRuns(runs) {
    set({ runs })
  },

  prependRun(run) {
    set((s) => ({ runs: [run, ...s.runs] }))
  },

  updateRun(run) {
    set((s) => ({
      runs: s.runs.map((r) => (r.id === run.id ? run : r)),
    }))
  },

  toggleExpand(runId) {
    set((s) => ({
      expandedRunId: s.expandedRunId === runId ? null : runId,
    }))
  },

  setLoading(loading) {
    set({ isLoading: loading })
  },

  setError(error) {
    set({ error })
  },
}))
