'use client'

import { memo, useRef } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Plus, Trash2, Type, Image as ImageIcon } from 'lucide-react'
import { nanoid } from 'nanoid'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/store/workflow-store'
import type { RequestInputsNodeData, InputField } from '@/lib/types'

export const RequestInputsNode = memo(({ id, data }: NodeProps<RequestInputsNodeData>) => {
  const { updateNodeData, executingNodeIds } = useWorkflowStore()
  const isExecuting = executingNodeIds.has(id)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function addField(type: InputField['type']) {
    const label = type === 'text_field' ? `text_field` : `image_field`
    const newField: InputField = { id: nanoid(), type, label, value: '' }
    updateNodeData(id, { fields: [...data.fields, newField] })
  }

  function removeField(fieldId: string) {
    updateNodeData(id, { fields: data.fields.filter((f) => f.id !== fieldId) })
  }

  function updateField(fieldId: string, patch: Partial<InputField>) {
    updateNodeData(id, {
      fields: data.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
    })
  }

  async function handleImageUpload(fieldId: string, file: File) {
    // Preview locally using object URL
    const url = URL.createObjectURL(file)
    updateField(fieldId, { value: url })
  }

  return (
    <div
      className={cn(
        'min-w-[280px] max-w-[320px] rounded-xl border border-[#2a2a2a] bg-[#161616] shadow-xl',
        isExecuting && 'node-executing',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 rounded-t-xl border-b border-[#2a2a2a] bg-[#1e1e1e] px-3 py-2.5">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-violet-600/20">
          <div className="h-2 w-2 rounded-full bg-violet-400" />
        </div>
        <span className="text-xs font-semibold text-white">{data.label}</span>
        <span className="ml-auto rounded bg-[#2a2a2a] px-1.5 py-0.5 text-[10px] text-zinc-400">
          INPUT
        </span>
      </div>

      {/* Fields */}
      <div className="space-y-2 p-3">
        {data.fields.map((field) => (
          <div key={field.id} className="group relative rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-2">
            {/* Field label row */}
            <div className="mb-1.5 flex items-center gap-1.5">
              {field.type === 'text_field' ? (
                <Type className="h-3 w-3 text-violet-400" />
              ) : (
                <ImageIcon className="h-3 w-3 text-emerald-400" />
              )}
              <input
                className="flex-1 bg-transparent text-[11px] font-medium text-zinc-300 outline-none placeholder:text-zinc-600"
                value={field.label}
                onChange={(e) => updateField(field.id, { label: e.target.value })}
                placeholder="Field name"
              />
              <button
                onClick={() => removeField(field.id)}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            {/* Field input */}
            {field.type === 'text_field' ? (
              <textarea
                className="w-full resize-none rounded bg-[#111] px-2 py-1.5 text-[11px] text-zinc-300 outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-violet-500/50"
                rows={2}
                value={field.value}
                onChange={(e) => updateField(field.id, { value: e.target.value })}
                placeholder="Enter text..."
              />
            ) : (
              <div className="relative">
                {field.value ? (
                  <div className="relative rounded overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={field.value}
                      alt="uploaded"
                      className="h-20 w-full object-cover rounded"
                    />
                    <button
                      onClick={() => updateField(field.id, { value: '' })}
                      className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white hover:bg-red-500/80"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRefs.current[field.id]?.click()}
                    className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-[#2a2a2a] py-3 text-[11px] text-zinc-500 hover:border-violet-500/50 hover:text-zinc-400 transition-colors"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Click to upload image
                  </button>
                )}
                <input
                  ref={(el) => { fileInputRefs.current[field.id] = el }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImageUpload(field.id, file)
                  }}
                />
              </div>
            )}

            {/* Output handle per field */}
            <Handle
              type="source"
              position={Position.Right}
              id={`field-${field.id}`}
              style={{ right: -12, top: '50%', background: field.type === 'text_field' ? '#a855f7' : '#10b981' }}
              className="!h-3 !w-3 !rounded-full !border-2 !border-[#161616]"
            />
          </div>
        ))}

        {/* Add field buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => addField('text_field')}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-dashed border-[#2a2a2a] py-1.5 text-[11px] text-zinc-500 hover:border-violet-500/40 hover:text-zinc-400 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Text
          </button>
          <button
            onClick={() => addField('image_field')}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-dashed border-[#2a2a2a] py-1.5 text-[11px] text-zinc-500 hover:border-emerald-500/40 hover:text-zinc-400 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Image
          </button>
        </div>
      </div>
    </div>
  )
})

RequestInputsNode.displayName = 'RequestInputsNode'
