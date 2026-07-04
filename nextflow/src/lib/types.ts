import type { Node, Edge } from 'reactflow'

// ─── Node data shapes ────────────────────────────────────────────────────────

export type HandleType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'any'

export interface HandleMeta {
  id: string
  label: string
  type: HandleType
}

// Request-Inputs field
export type InputFieldType = 'text_field' | 'image_field'

export interface InputField {
  id: string
  type: InputFieldType
  label: string
  value: string        // runtime value (text or uploaded image URL)
}

export interface RequestInputsNodeData {
  nodeType: 'request-inputs'
  label: string
  fields: InputField[]
}

// Crop Image
export interface CropImageNodeData {
  nodeType: 'crop-image'
  label: string
  // Connected handle IDs (if set, manual input is disabled)
  inputImageConnection: string | null
  // Manual/default values
  x: number
  y: number
  width: number
  height: number
}

// Gemini
export interface GeminiNodeData {
  nodeType: 'gemini'
  label: string
  model: string
  systemPrompt: string
  // Connected handle IDs
  promptConnection: string | null
  imageConnections: string[]
  // Manual prompt (used when not connected)
  manualPrompt: string
  // Output
  response: string | null
  isStreaming: boolean
}

// Response
export interface ResponseSlot {
  label: string
  value: string | null
}

export interface ResponseNodeData {
  nodeType: 'response'
  label: string
  resultConnection: string | null  // kept for backward-compat (single slot)
  result: string | null            // kept for backward-compat (single slot)
  slots: ResponseSlot[]            // multi-slot: one per connected edge
}

export type NodeData =
  | RequestInputsNodeData
  | CropImageNodeData
  | GeminiNodeData
  | ResponseNodeData

export type WorkflowNode = Node<NodeData>
export type WorkflowEdge = Edge

// ─── Graph snapshot (for undo/redo) ──────────────────────────────────────────

export interface GraphSnapshot {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

// ─── Workflow / Run types ─────────────────────────────────────────────────────

export type RunStatus = 'running' | 'success' | 'failed' | 'partial'
export type RunScope = 'full' | 'partial' | 'single'
export type NodeRunStatus = 'pending' | 'running' | 'success' | 'failed'

export interface NodeRunRecord {
  id: string
  nodeId: string
  nodeType: string
  nodeLabel: string
  status: NodeRunStatus
  inputs: Record<string, unknown> | null
  output: Record<string, unknown> | null
  error: string | null
  startedAt: string | null
  finishedAt: string | null
  duration: number | null
}

export interface WorkflowRunRecord {
  id: string
  workflowId: string
  userId: string
  status: RunStatus
  scope: RunScope
  startedAt: string
  finishedAt: string | null
  nodeRuns: NodeRunRecord[]
}

export interface WorkflowRecord {
  id: string
  userId: string
  name: string
  graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }
  createdAt: string
  updatedAt: string
  runs?: WorkflowRunRecord[]
}

// ─── API payloads ─────────────────────────────────────────────────────────────

export interface CreateWorkflowPayload {
  name: string
}

export interface SaveWorkflowPayload {
  name?: string
  graph?: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }
}

export interface TriggerRunPayload {
  scope: RunScope
  nodeIds?: string[]
  inputs?: Record<string, string>
}
