'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type ReactFlowInstance,
} from 'reactflow'
import { nanoid } from 'nanoid'
import { Plus, Undo2, Redo2, Download, Upload } from 'lucide-react'
import { useWorkflowStore } from '@/store/workflow-store'
import { RequestInputsNode } from './nodes/RequestInputsNode'
import { CropImageNode } from './nodes/CropImageNode'
import { GeminiNode } from './nodes/GeminiNode'
import { ResponseNode } from './nodes/ResponseNode'
import { AnimatedEdge } from './edges/AnimatedEdge'
import { NodePicker } from './NodePicker'
import { makeNodeLabel } from '@/lib/utils'
import type { WorkflowNode, CropImageNodeData, GeminiNodeData, HandleType } from '@/lib/types'

const NODE_TYPES: NodeTypes = {
  requestInputs: RequestInputsNode,
  cropImage: CropImageNode,
  gemini: GeminiNode,
  response: ResponseNode,
}

const EDGE_TYPES: EdgeTypes = {
  animated: AnimatedEdge,
}

const HANDLE_TYPES: Record<string, HandleType> = {
  'handle-image-in':    'image',
  'handle-image-out':   'image',
  'handle-prompt-in':   'text',
  'handle-response-out':'text',
  'handle-result-in':   'text',
}

function getHandleType(handleId: string | null): HandleType {
  if (!handleId) return 'any'
  if (handleId.startsWith('field-')) return 'any'
  return HANDLE_TYPES[handleId] ?? 'any'
}

interface CanvasProps {
  workflowId: string
  isSaving: boolean
}

function CanvasInner({ workflowId, isSaving }: CanvasProps) {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    addNode, undo, redo, canUndo, canRedo,
  } = useWorkflowStore()

  const [showPicker, setShowPicker] = useState(false)
  const rfInstance = useRef<ReactFlowInstance | null>(null)

  const isValidConnection = useCallback((connection: Connection) => {
    const srcType = getHandleType(connection.sourceHandle ?? null)
    const tgtType = getHandleType(connection.targetHandle ?? null)
    if (srcType === 'any' || tgtType === 'any') return true
    return srcType === tgtType
  }, [])

  const handleConnect = useCallback((connection: Connection) => {
    if (!isValidConnection(connection)) return
    onConnect(connection)
  }, [isValidConnection, onConnect])

  function handleAddNode(nodeTypeId: string) {
    setShowPicker(false)
    const viewport = rfInstance.current?.getViewport() ?? { x: 0, y: 0, zoom: 1 }
    const existingLabels = nodes.map((n) => (n.data as { label: string }).label)

    // Place new node near center of current viewport
    const pos = {
      x: (-viewport.x + window.innerWidth / 2 - 150) / viewport.zoom,
      y: (-viewport.y + window.innerHeight / 2 - 100) / viewport.zoom,
    }

    if (nodeTypeId === 'crop-image') {
      const node: WorkflowNode = {
        id: nanoid(),
        type: 'cropImage',
        position: pos,
        data: {
          nodeType: 'crop-image',
          label: makeNodeLabel('Crop Image', existingLabels),
          inputImageConnection: null,
          x: 0, y: 0, width: 100, height: 100,
        } satisfies CropImageNodeData,
      }
      addNode(node)
    } else if (nodeTypeId === 'gemini') {
      const node: WorkflowNode = {
        id: nanoid(),
        type: 'gemini',
        position: pos,
        data: {
          nodeType: 'gemini',
          label: makeNodeLabel('Gemini', existingLabels),
          model: 'gemini-1.5-pro',
          systemPrompt: '',
          promptConnection: null,
          imageConnections: [],
          manualPrompt: '',
          response: null,
          isStreaming: false,
        } satisfies GeminiNodeData,
      }
      addNode(node)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); undo()
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  function handleExport() {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'workflow.json'; a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const { nodes: n, edges: ed } = JSON.parse(await file.text()) as {
          nodes: WorkflowNode[]; edges: typeof edges
        }
        useWorkflowStore.getState().init(workflowId, useWorkflowStore.getState().workflowName, n, ed)
      } catch { alert('Invalid workflow JSON') }
    }
    input.click()
  }

  return (
    <div className="relative flex-1 bg-[#0d0d0d]">
      <ReactFlow
        nodes={nodes}
        edges={edges.map((e) => ({ ...e, type: 'animated' }))}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        isValidConnection={isValidConnection}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onInit={(i) => { rfInstance.current = i }}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 0.9 }}
        deleteKeyCode={['Backspace', 'Delete']}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'animated' }}
        proOptions={{ hideAttribution: true }}
      >
        {/* Dark dot grid — matches Galaxy.ai */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#262626"
        />

        {/* Controls — bottom-left, above toolbar */}
        <Controls
          position="bottom-left"
          style={{ bottom: 80, left: 16 }}
          showInteractive={false}
        />

        {/* MiniMap — bottom-right, above toolbar */}
        <MiniMap
          position="bottom-right"
          style={{ bottom: 80, right: 16, width: 140, height: 90 }}
          nodeColor="#2a2a2a"
          maskColor="rgba(139,92,246,0.1)"
          zoomable
          pannable
        />
      </ReactFlow>

      {/* ── Bottom floating toolbar — Galaxy.ai style ── */}
      <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2">
        <div className="flex items-center gap-0.5 rounded-2xl border border-[#252525] bg-[#141414] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">

          {/* Undo */}
          <button
            onClick={undo}
            disabled={!canUndo()}
            title="Undo (⌘Z)"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-500 transition-all hover:bg-[#1e1e1e] hover:text-zinc-300 disabled:opacity-25 disabled:cursor-not-allowed"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>

          {/* Redo */}
          <button
            onClick={redo}
            disabled={!canRedo()}
            title="Redo (⌘⇧Z)"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-500 transition-all hover:bg-[#1e1e1e] hover:text-zinc-300 disabled:opacity-25 disabled:cursor-not-allowed"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>

          {/* Divider */}
          <div className="mx-1 h-5 w-px bg-[#2a2a2a]" />

          {/* ＋ Add node — prominent center button */}
          <button
            onClick={() => setShowPicker(true)}
            title="Add node"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-[0_0_12px_rgba(124,58,237,0.5)] transition-all hover:bg-violet-500 hover:shadow-[0_0_18px_rgba(124,58,237,0.7)]"
          >
            <Plus className="h-4 w-4" />
          </button>

          {/* Divider */}
          <div className="mx-1 h-5 w-px bg-[#2a2a2a]" />

          {/* Export */}
          <button
            onClick={handleExport}
            title="Export JSON"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-500 transition-all hover:bg-[#1e1e1e] hover:text-zinc-300"
          >
            <Download className="h-3.5 w-3.5" />
          </button>

          {/* Import */}
          <button
            onClick={handleImport}
            title="Import JSON"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-500 transition-all hover:bg-[#1e1e1e] hover:text-zinc-300"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Saving indicator below toolbar */}
        {isSaving && (
          <p className="mt-1.5 text-center text-[10px] text-zinc-600">Saving…</p>
        )}
      </div>

      {/* Node picker */}
      {showPicker && (
        <NodePicker onSelect={handleAddNode} onClose={() => setShowPicker(false)} />
      )}
    </div>
  )
}

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
