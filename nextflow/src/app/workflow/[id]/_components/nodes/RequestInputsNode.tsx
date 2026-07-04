'use client'

import { memo, useRef, useState } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Plus, Trash2, Copy, Image as ImageIcon, HelpCircle, Loader2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { cn } from '@/lib/utils'
import { uploadImage } from '@/lib/upload'
import { useWorkflowStore } from '@/store/workflow-store'
import type { RequestInputsNodeData, InputField } from '@/lib/types'

const DOT_COLOR: Record<InputField['type'], string> = {
  text_field:  'bg-orange-400',
  image_field: 'bg-emerald-400',
}

export const RequestInputsNode = memo(({ id, data }: NodeProps<RequestInputsNodeData>) => {
  const { updateNodeData, executingNodeIds } = useWorkflowStore()
  const isExecuting = executingNodeIds.has(id)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  // Track upload-in-progress per field
  const [uploadingFields, setUploadingFields] = useState<Set<string>>(new Set())

  function addField(type: InputField['type']) {
    const existing = data.fields.filter((f) => f.type === type).length
    const base = type === 'text_field' ? 'text_field' : 'image_field'
    const label = existing === 0 ? base : `${base}_${existing + 1}`
    updateNodeData(id, { fields: [...data.fields, { id: nanoid(), type, label, value: '' }] })
  }

  function removeField(fieldId: string) {
    updateNodeData(id, { fields: data.fields.filter((f) => f.id !== fieldId) })
  }

  function updateField(fieldId: string, patch: Partial<InputField>) {
    updateNodeData(id, {
      fields: data.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
    })
  }

  async function handleImageSelect(fieldId: string, file: File) {
    // 1. Show local preview immediately
    const previewUrl = URL.createObjectURL(file)
    updateField(fieldId, { value: previewUrl })

    // 2. Mark uploading
    setUploadingFields((prev) => new Set(prev).add(fieldId))

    try {
      // 3. Upload to server — get permanent URL
      const permanentUrl = await uploadImage(file)
      // 4. Swap preview for permanent URL
      updateField(fieldId, { value: permanentUrl })
      URL.revokeObjectURL(previewUrl)
    } catch (err) {
      console.error('[RequestInputsNode] upload failed', err)
      // Keep preview so the user can see something, but log the failure
    } finally {
      setUploadingFields((prev) => {
        const next = new Set(prev)
        next.delete(fieldId)
        return next
      })
    }
  }

  return (
    <div
      className={cn(
        'w-[280px] rounded-xl border border-[#e8e8e8] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)]',
        isExecuting && 'node-executing',
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-[#f0f0f0]">
        <span className="flex-1 text-[13px] font-semibold text-[#1a1a2e]">{data.label}</span>
        <button title="Info" className="text-[#cccccc] hover:text-[#888888] transition-colors">
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
        <button
          title="Add text field"
          onClick={() => addField('text_field')}
          className="flex h-5 w-5 items-center justify-center rounded text-[#aaaaaa] hover:bg-[#f0f0f0] hover:text-[#555555] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Fields ── */}
      <div className="divide-y divide-[#f5f5f5]">
        {data.fields.map((field) => (
          <div key={field.id} className="group relative px-3 py-2.5">

            {/* Label row */}
            <div className="flex items-center gap-2">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT_COLOR[field.type])} />
              <input
                className="flex-1 bg-transparent text-[12px] font-medium text-[#333333] outline-none placeholder:text-[#bbbbbb] min-w-0"
                value={field.label}
                onChange={(e) => updateField(field.id, { label: e.target.value })}
                placeholder="Field name"
              />
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  title="Copy field id"
                  onClick={() => navigator.clipboard.writeText(field.id)}
                  className="flex h-5 w-5 items-center justify-center rounded text-[#cccccc] hover:text-[#777777] transition-colors"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <button
                  title="Remove field"
                  onClick={() => removeField(field.id)}
                  className="flex h-5 w-5 items-center justify-center rounded text-[#cccccc] hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Field value */}
            <div className="mt-2">
              {field.type === 'text_field' ? (
                <textarea
                  className="w-full resize-none rounded-lg border border-[#eeeeee] bg-[#fafafa] px-2.5 py-2 text-[11px] text-[#333333] outline-none placeholder:text-[#cccccc] focus:border-[#d0d0d0] focus:bg-white transition-colors"
                  rows={2}
                  value={field.value}
                  onChange={(e) => updateField(field.id, { value: e.target.value })}
                  placeholder="Enter text..."
                />
              ) : (
                <div>
                  {field.value ? (
                    <div className="relative overflow-hidden rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={field.value} alt="uploaded" className="h-20 w-full object-cover" />
                      {/* Upload progress overlay */}
                      {uploadingFields.has(field.id) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-lg">
                          <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                        </div>
                      )}
                      <button
                        onClick={() => updateField(field.id, { value: '' })}
                        className="absolute right-1 top-1 rounded bg-white/80 p-0.5 text-[#555555] hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRefs.current[field.id]?.click()}
                      disabled={uploadingFields.has(field.id)}
                      className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[#e0e0e0] px-3 py-2.5 text-[11px] text-[#aaaaaa] hover:border-emerald-300 hover:text-emerald-500 transition-colors disabled:opacity-50"
                    >
                      {uploadingFields.has(field.id)
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                        : <ImageIcon className="h-3.5 w-3.5 shrink-0" />}
                      {uploadingFields.has(field.id) ? 'Uploading…' : 'Upload image'}
                    </button>
                  )}
                  <input
                    ref={(el) => { fileInputRefs.current[field.id] = el }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handleImageSelect(field.id, f)
                      // reset so same file can be re-selected
                      e.target.value = ''
                    }}
                  />
                </div>
              )}
            </div>

            {/* Per-field source handle */}
            <Handle
              type="source"
              position={Position.Right}
              id={`field-${field.id}`}
              style={{
                right: -8,
                top: '50%',
                background: field.type === 'text_field' ? '#fb923c' : '#34d399',
                width: 10,
                height: 10,
                border: '2px solid white',
              }}
            />
          </div>
        ))}
      </div>

      {/* ── Add field buttons ── */}
      <div className="flex gap-2 border-t border-[#f0f0f0] px-3 py-2.5">
        <button
          onClick={() => addField('text_field')}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#e8e8e8] py-1.5 text-[11px] text-[#aaaaaa] hover:border-orange-300 hover:text-orange-400 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Text
        </button>
        <button
          onClick={() => addField('image_field')}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#e8e8e8] py-1.5 text-[11px] text-[#aaaaaa] hover:border-emerald-300 hover:text-emerald-400 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Image
        </button>
      </div>
    </div>
  )
})

RequestInputsNode.displayName = 'RequestInputsNode'
