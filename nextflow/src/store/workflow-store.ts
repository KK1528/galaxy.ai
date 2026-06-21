'use client'

import { create } from 'zustand'
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from 'reactflow'
import { detectCycle } from '@/lib/dag'
import type { WorkflowNode, WorkflowEdge, GraphSnapshot, NodeData } from '@/lib/types'

const MAX_HISTORY = 50

interface WorkflowState {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  past: GraphSnapshot[]
  future: GraphSnapshot[]
  executingNodeIds: Set<string>
  workflowId: string | null
  workflowName: string

  // Initialise canvas from a saved workflow
  init: (id: string, name: string, nodes: WorkflowNode[], edges: WorkflowEdge[]) => void

  // React Flow change handlers
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => boolean  // returns false if invalid

  // Node CRUD
  addNode: (node: WorkflowNode) => void
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void
  deleteNode: (nodeId: string) => void

  // Edge CRUD
  deleteEdge: (edgeId: string) => void

  // Undo / Redo
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // Execution glow
  setExecuting: (nodeId: string, executing: boolean) => void
  clearExecuting: () => void
}

function snapshot(state: Pick<WorkflowState, 'nodes' | 'edges'>): GraphSnapshot {
  return {
    nodes: JSON.parse(JSON.stringify(state.nodes)),
    edges: JSON.parse(JSON.stringify(state.edges)),
  }
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  past: [],
  future: [],
  executingNodeIds: new Set(),
  workflowId: null,
  workflowName: 'Untitled Workflow',

  init(id, name, nodes, edges) {
    set({ nodes, edges, workflowId: id, workflowName: name, past: [], future: [] })
  },

  onNodesChange(changes) {
    // Filter out deletions of protected nodes (request-inputs, response)
    const safeChanges = changes.filter((c) => {
      if (c.type !== 'remove') return true
      const node = get().nodes.find((n) => n.id === c.id)
      if (!node) return true
      const t = (node.data as NodeData).nodeType
      return t !== 'request-inputs' && t !== 'response'
    })
    set({ nodes: applyNodeChanges(safeChanges, get().nodes) as WorkflowNode[] })
  },

  onEdgesChange(changes) {
    set({ edges: applyEdgeChanges(changes, get().edges) as WorkflowEdge[] })
  },

  onConnect(connection) {
    const { nodes, edges } = get()
    const tentativeEdges = addEdge(connection, edges) as WorkflowEdge[]
    if (detectCycle(nodes, tentativeEdges)) return false

    const prev = snapshot(get())
    set((s) => ({
      edges: tentativeEdges,
      past: [...s.past.slice(-MAX_HISTORY), prev],
      future: [],
    }))
    return true
  },

  addNode(node) {
    const prev = snapshot(get())
    set((s) => ({
      nodes: [...s.nodes, node],
      past: [...s.past.slice(-MAX_HISTORY), prev],
      future: [],
    }))
  },

  updateNodeData(nodeId, data) {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? ({ ...n, data: { ...n.data, ...data } } as WorkflowNode)
          : n,
      ),
    }))
  },

  deleteNode(nodeId) {
    const node = get().nodes.find((n) => n.id === nodeId)
    if (!node) return
    const t = (node.data as NodeData).nodeType
    if (t === 'request-inputs' || t === 'response') return  // protected

    const prev = snapshot(get())
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      past: [...s.past.slice(-MAX_HISTORY), prev],
      future: [],
    }))
  },

  deleteEdge(edgeId) {
    const prev = snapshot(get())
    set((s) => ({
      edges: s.edges.filter((e) => e.id !== edgeId),
      past: [...s.past.slice(-MAX_HISTORY), prev],
      future: [],
    }))
  },

  undo() {
    const { past, nodes, edges } = get()
    if (!past.length) return
    const prev = past[past.length - 1]
    const current = snapshot({ nodes, edges })
    set((s) => ({
      nodes: prev.nodes,
      edges: prev.edges,
      past: s.past.slice(0, -1),
      future: [current, ...s.future].slice(0, MAX_HISTORY),
    }))
  },

  redo() {
    const { future, nodes, edges } = get()
    if (!future.length) return
    const next = future[0]
    const current = snapshot({ nodes, edges })
    set((s) => ({
      nodes: next.nodes,
      edges: next.edges,
      future: s.future.slice(1),
      past: [...s.past, current].slice(-MAX_HISTORY),
    }))
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  setExecuting(nodeId, executing) {
    set((s) => {
      const next = new Set(s.executingNodeIds)
      executing ? next.add(nodeId) : next.delete(nodeId)
      return { executingNodeIds: next }
    })
  },

  clearExecuting() {
    set({ executingNodeIds: new Set() })
  },
}))
