'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type ReactFlowInstance,
} from 'reactflow'
import { nanoid } from 'nanoid'
import {
  ChevronLeft, ChevronRight, Undo2, Redo2, Command,
  ZoomIn, ZoomOut, Maximize2, LayoutGrid, Move,
  FileText, Plus,
} from 'lucide-react'
import { useWorkflowStore } from '@/store/workflow-store'
import { RequestInputsNode } from './nodes/RequestInputsNode'
import { CropImageNode } from './nodes/CropImageNode'
import { GeminiNode } from './nodes/GeminiNode'
import { ResponseNode } from './nodes/ResponseNode'
import { AnimatedEdge } from './edges/AnimatedEdge'
import { NodePicker } from './NodePicker'
import { makeNodeLabel } from '@/lib/utils'
import { cn } from '@/lib/utils'
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

function ToolbarBtn({
  onClick,
  title,
  disabled,
  active,
  children,
}: {
  onClick?: () => void
  title?: string
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg transition-colors text-[#444e68]',
        active ? 'bg-[#f0f0f0] text-[#1a1a2e]' : 'hover:bg-[#f5f5f5]',
        disabled && 'opacity-30 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  )
}

function CanvasInner({ workflowId, isSaving }: CanvasProps) {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    addNode, undo, redo, canUndo, canRedo,
  } = useWorkflowStore()

  const [showPicker, setShowPicker] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
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
    const pos = {
      x: (-viewport.x + window.innerWidth / 2 - 150) / viewport.zoom,
      y: (-viewport.y + window.innerHeight / 2 - 100) / viewport.zoom,
    }
    if (nodeTypeId === 'crop-image') {
      addNode({
        id: nanoid(), type: 'cropImage', position: pos,
        data: {
          nodeType: 'crop-image',
          label: makeNodeLabel('Crop Image', existingLabels),
          inputImageConnection: null,
          x: 0, y: 0, width: 100, height: 100,
        } satisfies CropImageNodeData,
      } as WorkflowNode)
    } else if (nodeTypeId === 'gemini') {
      addNode({
        id: nanoid(), type: 'gemini', position: pos,
        data: {
          nodeType: 'gemini',
          label: makeNodeLabel('Gemini', existingLabels),
          model: 'gemini-2.0-flash',
          systemPrompt: '',
          promptConnection: null,
          imageConnections: [],
          manualPrompt: '',
          response: null,
          isStreaming: false,
        } satisfies GeminiNodeData,
      } as WorkflowNode)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  function zoomIn() {
    rfInstance.current?.zoomIn()
    setZoom(Math.round((rfInstance.current?.getZoom() ?? 1) * 100))
  }

  function zoomOut() {
    rfInstance.current?.zoomOut()
    setZoom(Math.round((rfInstance.current?.getZoom() ?? 1) * 100))
  }

  function fitView() {
    rfInstance.current?.fitView({ padding: 0.2 })
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges.map((e) => ({ ...e, type: 'animated' }))}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        isValidConnection={isValidConnection}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onInit={(i) => {
          rfInstance.current = i
          setZoom(Math.round(i.getZoom() * 100))
        }}
        onMoveEnd={() => {
          setZoom(Math.round((rfInstance.current?.getZoom() ?? 1) * 100))
        }}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 0.9 }}
        deleteKeyCode={['Backspace', 'Delete']}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'animated' }}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#eeeef0' }}
      >
        {/* Dot grid — matches screenshots exactly */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1.5}
          color="#c8c8cc"
          style={{ background: '#eeeef0' }}
        />
      </ReactFlow>

      {/* ── Bottom floating toolbar ── */}
      <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 flex items-end gap-3">

        {/* Main toolbar pill */}
        <div className="flex items-center gap-0.5 rounded-2xl bg-white px-2 py-1.5 shadow-[0_2px_16px_rgba(0,0,0,0.12)] border border-[#e8e8e8] transition-all duration-200">

          {/* Collapse / expand toggle — always visible */}
          <ToolbarBtn
            title={toolbarCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}
            onClick={() => setToolbarCollapsed((v) => !v)}
          >
            {toolbarCollapsed
              ? <ChevronRight className="h-4 w-4" />
              : <ChevronLeft className="h-4 w-4" />}
          </ToolbarBtn>

          {/* Everything below is hidden when collapsed */}
          {!toolbarCollapsed && (
            <>
              {/* Divider */}
              <div className="mx-0.5 h-5 w-px bg-[#e8e8e8]" />

              {/* Undo */}
              <ToolbarBtn title="Undo (⌘Z)" onClick={undo} disabled={!canUndo()}>
                <Undo2 className="h-3.5 w-3.5" />
              </ToolbarBtn>

              {/* Redo */}
              <ToolbarBtn title="Redo (⌘⇧Z)" onClick={redo} disabled={!canRedo()}>
                <Redo2 className="h-3.5 w-3.5" />
              </ToolbarBtn>

              {/* Shortcuts */}
              <ToolbarBtn title="Keyboard shortcuts">
                <Command className="h-3.5 w-3.5" />
              </ToolbarBtn>

              {/* Divider */}
              <div className="mx-0.5 h-5 w-px bg-[#e8e8e8]" />

              {/* Zoom out */}
              <ToolbarBtn title="Zoom out" onClick={zoomOut}>
                <ZoomOut className="h-3.5 w-3.5" />
              </ToolbarBtn>

              {/* Zoom % — click to reset to 100% */}
              <button
                onClick={() => { rfInstance.current?.zoomTo(1); setZoom(100) }}
                title="Reset zoom"
                className="min-w-[46px] px-1 text-center text-xs font-medium text-[#444e68] hover:bg-[#f5f5f5] rounded-lg h-8 transition-colors"
              >
                {zoom}%
              </button>

              {/* Zoom in */}
              <ToolbarBtn title="Zoom in" onClick={zoomIn}>
                <ZoomIn className="h-3.5 w-3.5" />
              </ToolbarBtn>

              {/* Divider */}
              <div className="mx-0.5 h-5 w-px bg-[#e8e8e8]" />

              {/* Fit view */}
              <ToolbarBtn title="Fit to screen" onClick={fitView}>
                <Maximize2 className="h-3.5 w-3.5" />
              </ToolbarBtn>

              {/* Grid toggle */}
              <ToolbarBtn title="Toggle grid">
                <LayoutGrid className="h-3.5 w-3.5" />
              </ToolbarBtn>

              {/* Auto-layout */}
              <ToolbarBtn title="Auto-layout">
                <Move className="h-3.5 w-3.5" />
              </ToolbarBtn>
            </>
          )}
        </div>

        {/* Add node pill — always visible */}
        <div className="flex items-center gap-1 rounded-2xl bg-white px-2 py-1.5 shadow-[0_2px_16px_rgba(0,0,0,0.12)] border border-[#e8e8e8]">
          <ToolbarBtn title="Templates">
            <FileText className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn title="Add node" onClick={() => setShowPicker(true)}>
            <Plus className="h-4 w-4" />
          </ToolbarBtn>
        </div>
      </div>

      {/* Saving indicator */}
      {isSaving && (
        <div className="absolute bottom-20 left-1/2 z-20 -translate-x-1/2">
          <p className="text-[10px] text-[#aaaaaa]">Saving…</p>
        </div>
      )}

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
      <div className="h-full w-full">
        <CanvasInner {...props} />
      </div>
    </ReactFlowProvider>
  )
}
