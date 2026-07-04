'use client'

import { memo, useRef, useState } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { MoreHorizontal, Upload, Plus, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { uploadImage } from '@/lib/upload'
import { useWorkflowStore } from '@/store/workflow-store'
import type { CropImageNodeData } from '@/lib/types'

const PARAMS = [
  { key: 'x',      label: 'X Position (%)' },
  { key: 'y',      label: 'Y Position (%)' },
  { key: 'width',  label: 'Width (%)'      },
  { key: 'height', label: 'Height (%)'     },
] as const

export const CropImageNode = memo(({ id, data }: NodeProps<CropImageNodeData>) => {
  const { updateNodeData, deleteNode, executingNodeIds } = useWorkflowStore()
  const isExecuting = executingNodeIds.has(id)
  const [showMenu, setShowMenu] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  // Locally stored uploaded image URL for manual (non-edge) input
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(
    data.inputImageConnection ?? null,
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  function update(patch: Partial<CropImageNodeData>) {
    updateNodeData(id, patch)
  }

  async function handleImageSelect(file: File) {
    const previewUrl = URL.createObjectURL(file)
    setLocalImageUrl(previewUrl)
    setIsUploading(true)
    try {
      const permanentUrl = await uploadImage(file)
      setLocalImageUrl(permanentUrl)
      // Store on node data so the orchestrator can read it
      update({ inputImageConnection: permanentUrl })
      URL.revokeObjectURL(previewUrl)
    } catch (err) {
      console.error('[CropImageNode] upload failed', err)
      setLocalImageUrl(null)
    } finally {
      setIsUploading(false)
    }
  }

  function clearImage() {
    setLocalImageUrl(null)
    update({ inputImageConnection: null })
  }

  // An edge is connected to the image-in handle (takes precedence over manual upload)
  const edgeConnected = Boolean(data.inputImageConnection) && !localImageUrl?.startsWith('blob:')

  return (
    <div
      className={cn(
        'w-[280px] rounded-xl border border-[#e8e8e8] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)]',
        isExecuting && 'node-executing',
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#f0f0f0]">
        <span className="flex-1 text-[13px] font-semibold text-[#1a1a2e]">{data.label}</span>
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

        {/* Input Image */}
        <div className="relative">
          <Handle
            type="target"
            position={Position.Left}
            id="handle-image-in"
            title="Image input — connect an image source here"
            style={{ left: -8, top: '50%', background: '#34d399', width: 10, height: 10, border: '2px solid white' }}
          />
          {/* Handle type label */}
          <span className="absolute left-3 -top-[9px] rounded-full bg-emerald-100 px-1.5 py-0 text-[9px] font-semibold text-emerald-600 leading-5 pointer-events-none select-none">
            image
          </span>
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              <span className="flex-1 text-[12px] font-medium text-[#333333]">
                Input Image<span className="text-red-400">*</span>
              </span>
              <button className="flex h-5 w-5 items-center justify-center rounded text-[#cccccc] hover:text-[#777777] transition-colors">
                <Plus className="h-3 w-3" />
              </button>
            </div>

            {/* Show "Connected via edge" badge if an edge is wired */}
            {edgeConnected ? (
              <div className="flex items-center gap-2 rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-[#555555]">Connected via edge</span>
              </div>
            ) : localImageUrl ? (
              /* Manual upload preview */
              <div className="relative overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={localImageUrl} alt="input" className="h-20 w-full object-cover" />
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                  </div>
                )}
                <button
                  onClick={clearImage}
                  className="absolute right-1 top-1 rounded bg-white/80 p-0.5 text-[#555555] hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            ) : (
              /* Upload button */
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[#e0e0e0] px-3 py-2 text-[11px] text-[#aaaaaa] hover:border-emerald-300 hover:text-emerald-500 transition-colors disabled:opacity-50"
              >
                {isUploading
                  ? <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                  : <Upload className="h-3 w-3 shrink-0" />}
                {isUploading ? 'Uploading…' : 'Upload image'}
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

        {/* Crop params — X, Y, Width, Height — each with a connectable handle */}
        {PARAMS.map(({ key, label }) => (
          <div key={key} className="relative flex items-center gap-2 px-3 py-2.5">
            {/* Blue handle for numeric param inputs */}
            <Handle
              type="target"
              position={Position.Left}
              id={`handle-${key}-in`}
              title={label}
              style={{
                left: -8,
                top: '50%',
                background: '#60a5fa',
                width: 10,
                height: 10,
                border: '2px solid white',
              }}
            />
            <span className="h-2 w-2 shrink-0 rounded-full bg-blue-300" />
            <span className="flex-1 text-[12px] font-medium text-[#333333]">{label}</span>
            <input
              type="number"
              min={0}
              max={100}
              value={data[key] ?? 0}
              onChange={(e) => update({ [key]: Number(e.target.value) })}
              className="w-16 rounded-lg border border-[#eeeeee] bg-[#fafafa] px-2 py-1 text-center text-[11px] text-[#333333] outline-none focus:border-[#d0d0d0] focus:bg-white transition-colors"
            />
          </div>
        ))}

      </div>

      {/* ── Output row ── */}
      <div className="relative border-t border-[#f0f0f0]">
        <Handle
          type="source"
          position={Position.Right}
          id="handle-image-out"
          title="Image output — connect to an image input"
          style={{ right: -8, top: '50%', background: '#34d399', width: 10, height: 10, border: '2px solid white' }}
        />
        {/* Handle type label */}
        <span className="absolute right-3 -top-[9px] rounded-full bg-emerald-100 px-1.5 py-0 text-[9px] font-semibold text-emerald-600 leading-5 pointer-events-none select-none">
          image
        </span>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
          <span className="flex-1 text-[12px] font-medium text-[#333333]">Output Image</span>
        </div>
      </div>
    </div>
  )
})

CropImageNode.displayName = 'CropImageNode'
