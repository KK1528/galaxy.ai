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
  reset: () => void
}

export const useHistoryStore = create<HistoryState>((set) => ({
  runs: [],
  expandedRunId: null,
  isLoading: false,
  error: null,

  setRuns(runs) {
    // Merge incoming server data with any optimistic runs already in state.
    // Existing entries are updated in-place; new ones are appended.
    set((s) => {
      const map = new Map(s.runs.map((r) => [r.id, r]))
      for (const r of runs) map.set(r.id, r)
      // Preserve the server-defined order (newest first) while keeping
      // any optimistic runs that haven't been returned by the server yet.
      const serverIds = new Set(runs.map((r) => r.id))
      const optimistic = s.runs.filter((r) => !serverIds.has(r.id))
      return { runs: [...optimistic, ...runs] }
    })
  },

  prependRun(run) {
    // Only prepend if this run ID isn't already tracked (avoids duplicates
    // when the polling loop fetches the same run back from the server).
    set((s) => {
      if (s.runs.some((r) => r.id === run.id)) return s
      return { runs: [run, ...s.runs] }
    })
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

  reset() {
    set({ runs: [], expandedRunId: null, isLoading: false, error: null })
  },
}))
