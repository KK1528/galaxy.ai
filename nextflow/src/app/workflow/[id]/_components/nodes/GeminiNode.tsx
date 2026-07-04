'use client'

import { memo, useState, useRef } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import {
  ChevronDown, ChevronRight, Plus, MoreHorizontal,
  Upload, HelpCircle, Loader2, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { uploadImage } from '@/lib/upload'
import { useWorkflowStore } from '@/store/workflow-store'
import type { GeminiNodeData } from '@/lib/types'

const MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]

// Colored left-dot indicator per input row
function InputRow({
  dotColor,
  label,
  required,
  children,
  handleId,
  handleTop,
}: {
  dotColor: string
  label: string
  required?: boolean
  children?: React.ReactNode
  handleId: string
  handleTop: string
}) {
  return (
    <div className="relative">
      {/* Target handle */}
      <Handle
        type="target"
        position={Position.Left}
        id={handleId}
        style={{
          left: -8,
          top: handleTop,
          background: dotColor === 'bg-orange-400' ? '#fb923c'
            : dotColor === 'bg-emerald-400' ? '#34d399'
            : dotColor === 'bg-blue-400' ? '#60a5fa'
            : dotColor === 'bg-purple-400' ? '#c084fc'
            : dotColor === 'bg-amber-400' ? '#fbbf24'
            : '#a3a3a3',
          width: 10,
          height: 10,
          border: '2px solid white',
        }}
      />
      <div className="px-3 py-2.5 border-b border-[#f5f5f5] last:border-b-0">
        {/* Label row */}
        <div className="flex items-center gap-2 mb-0">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', dotColor)} />
          <span className="flex-1 text-[12px] font-medium text-[#333333]">
            {label}
            {required && <span className="text-red-400 ml-0.5">*</span>}
          </span>
          <button className="flex h-5 w-5 items-center justify-center rounded text-[#cccccc] hover:text-[#777777] transition-colors">
            <Plus className="h-3 w-3" />
          </button>
        </div>
        {/* Content */}
        {children && <div className="mt-2">{children}</div>}
      </div>
    </div>
  )
}

export const GeminiNode = memo(({ id, data }: NodeProps<GeminiNodeData>) => {
  const { updateNodeData, deleteNode, executingNodeIds, runNodeCallback } = useWorkflowStore()
  const isExecuting = executingNodeIds.has(id)
  const [showSettings, setShowSettings] = useState(false)
  const [showResponse, setShowResponse] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [isNodeRunning, setIsNodeRunning] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function update(patch: Partial<GeminiNodeData>) {
    updateNodeData(id, patch)
  }

  async function handleNodeRun(e: React.MouseEvent) {
    e.stopPropagation()
    if (!runNodeCallback || isNodeRunning) return
    setIsNodeRunning(true)
    try {
      await runNodeCallback(id)
    } finally {
      setIsNodeRunning(false)
    }
  }

  async function handleImageSelect(file: File) {
    const previewUrl = URL.createObjectURL(file)
    // Store preview immediately — imageConnections holds manual direct URLs
    update({ imageConnections: [previewUrl] })
    setIsUploadingImage(true)
    try {
      const permanentUrl = await uploadImage(file)
      update({ imageConnections: [permanentUrl] })
      URL.revokeObjectURL(previewUrl)
    } catch (err) {
      console.error('[GeminiNode] image upload failed', err)
    } finally {
      setIsUploadingImage(false)
    }
  }

  const promptConnected = Boolean(data.promptConnection)
  // First manual image URL (if any — not via edge connection)
  const manualImageUrl = data.imageConnections?.[0] ?? null

  // approximate handle top % for each input row — adjust based on rendered position
  const HANDLE_TOPS = {
    prompt:       '108px',
    systemPrompt: '186px',
    image:        '264px',
    settings:     '310px',
  }

  return (
    <div
      className={cn(
        'w-[300px] rounded-xl border border-[#e8e8e8] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)]',
        isExecuting && 'node-executing',
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#f0f0f0]">
        {/* Model selector */}
        <select
          value={data.model ?? 'gemini-2.0-flash'}
          onChange={(e) => update({ model: e.target.value })}
          className="flex-1 bg-transparent text-[13px] font-semibold text-[#1a1a2e] outline-none cursor-pointer"
        >
          {MODELS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* Run button */}
        <button
          onClick={(e) => void handleNodeRun(e)}
          disabled={isNodeRunning || isExecuting}
          className={cn(
            'flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold text-white transition-colors',
            isNodeRunning || isExecuting
              ? 'bg-[#86efac] cursor-not-allowed'
              : 'bg-[#22c55e] hover:bg-[#16a34a]',
          )}
        >
          {isNodeRunning || isExecuting ? (
            <><span className="h-2 w-2 rounded-full bg-white animate-pulse inline-block" /> Running</>
          ) : (
            <>▶ Run</>
          )}
        </button>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="flex h-6 w-6 items-center justify-center rounded text-[#cccccc] hover:bg-[#f0f0f0] hover:text-[#777777] transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-7 z-20 w-32 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white shadow-lg">
                <button
                  onClick={() => { setShowMenu(false); deleteNode(id) }}
                  className="flex w-full items-center px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50"
                >
                  Delete node
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Input rows ── */}
      <div className="divide-y divide-[#f5f5f5]">

        {/* Prompt* */}
        <div className="relative">
          <Handle
            type="target"
            position={Position.Left}
            id="handle-prompt-in"
            title="Text input — connect a text source here"
            style={{ left: -8, top: '50%', background: '#fb923c', width: 10, height: 10, border: '2px solid white' }}
          />
          <span className="absolute left-3 -top-[9px] rounded-full bg-orange-100 px-1.5 py-0 text-[9px] font-semibold text-orange-500 leading-5 pointer-events-none select-none">
            text
          </span>
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-orange-400" />
              <span className="flex-1 text-[12px] font-medium text-[#333333]">
                Prompt<span className="text-red-400">*</span>
              </span>
              <button className="flex h-5 w-5 items-center justify-center rounded text-[#cccccc] hover:text-[#777777] transition-colors">
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <textarea
              className={cn(
                'w-full resize-none rounded-lg border border-[#eeeeee] bg-[#fafafa] px-2.5 py-2 text-[11px] text-[#333333] outline-none placeholder:text-[#cccccc] focus:border-[#d0d0d0] focus:bg-white transition-colors',
                promptConnected && 'opacity-50 cursor-not-allowed',
              )}
              rows={3}
              value={data.manualPrompt ?? ''}
              onChange={(e) => update({ manualPrompt: e.target.value })}
              placeholder={promptConnected ? 'Using connected input…' : 'Enter your prompt…'}
              disabled={promptConnected}
            />
          </div>
        </div>

        {/* System Prompt */}
        <div className="relative">
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#d0d0d0]" />
              <span className="flex-1 text-[12px] font-medium text-[#333333]">System Prompt</span>
              <button className="flex h-5 w-5 items-center justify-center rounded text-[#cccccc] hover:text-[#777777] transition-colors">
                <HelpCircle className="h-3 w-3" />
              </button>
            </div>
            <textarea
              className="w-full resize-none rounded-lg border border-[#eeeeee] bg-[#fafafa] px-2.5 py-2 text-[11px] text-[#333333] outline-none placeholder:text-[#cccccc] focus:border-[#d0d0d0] focus:bg-white transition-colors"
              rows={2}
              value={data.systemPrompt ?? ''}
              onChange={(e) => update({ systemPrompt: e.target.value })}
              placeholder="You are a helpful assistant…"
            />
          </div>
        </div>

        {/* Image (Vision) */}
        <div className="relative">
          <Handle
            type="target"
            position={Position.Left}
            id="handle-image-in"
            title="Image input — connect an image source here"
            style={{ left: -8, top: '50%', background: '#34d399', width: 10, height: 10, border: '2px solid white' }}
          />
          <span className="absolute left-3 -top-[9px] rounded-full bg-emerald-100 px-1.5 py-0 text-[9px] font-semibold text-emerald-600 leading-5 pointer-events-none select-none">
            image
          </span>
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              <span className="flex-1 text-[12px] font-medium text-[#333333]">Image (Vision)</span>
              <button className="flex h-5 w-5 items-center justify-center rounded text-[#cccccc] hover:text-[#777777] transition-colors">
                <Plus className="h-3 w-3" />
              </button>
            </div>

            {manualImageUrl ? (
              <div className="relative overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={manualImageUrl} alt="vision input" className="h-20 w-full object-cover" />
                {isUploadingImage && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                  </div>
                )}
                <button
                  onClick={() => update({ imageConnections: [] })}
                  className="absolute right-1 top-1 rounded bg-white/80 p-0.5 text-[#555555] hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[#e0e0e0] px-3 py-2 text-[11px] text-[#aaaaaa] hover:border-emerald-300 hover:text-emerald-500 transition-colors disabled:opacity-50"
              >
                {isUploadingImage
                  ? <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                  : <Upload className="h-3 w-3 shrink-0" />}
                {isUploadingImage ? 'Uploading…' : 'Upload image'}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleImageSelect(f)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        {/* Settings (collapsible) */}
        <div className="px-3 py-2.5">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="flex w-full items-center gap-2 text-[12px] font-medium text-[#999999] hover:text-[#555555] transition-colors"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#e0e0e0]" />
            <span className="flex-1 text-left">Settings</span>
            {showSettings
              ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          </button>
          {showSettings && (
            <div className="mt-2 rounded-lg border border-[#eeeeee] bg-[#fafafa] px-3 py-2.5 text-[11px] text-[#aaaaaa]">
              Temperature, max tokens — coming soon
            </div>
          )}
        </div>

      </div>

      {/* ── Response / output ── */}
      <div className="relative border-t border-[#f0f0f0]">
        <Handle
          type="source"
          position={Position.Right}
          id="handle-response-out"
          title="Text output — connect to a text input"
          style={{ right: -8, top: '50%', background: '#a78bfa', width: 10, height: 10, border: '2px solid white' }}
        />
        <span className="absolute right-3 -top-[9px] rounded-full bg-violet-100 px-1.5 py-0 text-[9px] font-semibold text-violet-500 leading-5 pointer-events-none select-none">
          text
        </span>
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" />
            <span className="flex-1 text-[12px] font-medium text-[#333333]">Response</span>
            {data.response && (
              <button
                onClick={() => setShowResponse((v) => !v)}
                className="text-[#cccccc] hover:text-[#777777] transition-colors"
              >
                {showResponse ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
          {data.isStreaming && (
            <div className="flex items-center gap-1.5 text-[11px] text-violet-500">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
              Generating…
            </div>
          )}
          {data.response && showResponse ? (
            <div className="max-h-32 overflow-y-auto rounded-lg border border-[#eeeeee] bg-[#fafafa] px-2.5 py-2">
              <p className="text-[11px] text-[#333333] whitespace-pre-wrap">{data.response}</p>
            </div>
          ) : !data.response && !data.isStreaming ? (
            <p className="text-[11px] text-[#cccccc]">No output yet</p>
          ) : null}
        </div>
      </div>
    </div>
  )
})

GeminiNode.displayName = 'GeminiNode'
