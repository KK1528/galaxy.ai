'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Crop, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/store/workflow-store'
import type { CropImageNodeData } from '@/lib/types'

export const CropImageNode = memo(({ id, data }: NodeProps<CropImageNodeData>) => {
  const { updateNodeData, deleteNode, executingNodeIds } = useWorkflowStore()
  const isExecuting = executingNodeIds.has(id)

  function update(patch: Partial<CropImageNodeData>) {
    updateNodeData(id, patch)
  }

  const inputConnected = Boolean(data.inputImageConnection)

  return (
    <div
      className={cn(
        'min-w-[260px] rounded-xl border border-[#2a2a2a] bg-[#161616] shadow-xl',
        isExecuting && 'node-executing',
      )}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="handle-image-in"
        style={{ left: -12, top: '50%', background: '#10b981' }}
        className="!h-3 !w-3 !rounded-full !border-2 !border-[#161616]"
      />

      {/* Header */}
      <div className="flex items-center gap-2 rounded-t-xl border-b border-[#2a2a2a] bg-[#1e1e1e] px-3 py-2.5">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-600/20">
          <Crop className="h-3 w-3 text-emerald-400" />
        </div>
        <span className="text-xs font-semibold text-white">{data.label}</span>
        <button
          onClick={() => deleteNode(id)}
          className="ml-auto text-zinc-600 hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Params */}
      <div className="p-3 space-y-2">
        {/* Input Image field */}
        <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Input Image</span>
            <div className={cn('h-1.5 w-1.5 rounded-full', inputConnected ? 'bg-emerald-400' : 'bg-zinc-600')} />
          </div>
          {!inputConnected && (
            <p className="mt-1 text-[10px] text-zinc-600">Connect an image handle</p>
          )}
        </div>

        {/* Crop params grid */}
        {(
          [
            { key: 'x', label: 'X (%)' },
            { key: 'y', label: 'Y (%)' },
            { key: 'width', label: 'W (%)' },
            { key: 'height', label: 'H (%)' },
          ] as const
        ).map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-12 text-[11px] text-zinc-500">{label}</span>
            <input
              type="number"
              min={0}
              max={100}
              value={data[key] ?? 0}
              onChange={(e) => update({ [key]: Number(e.target.value) })}
              className="flex-1 rounded bg-[#111] px-2 py-1 text-[11px] text-zinc-300 outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>
        ))}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="handle-image-out"
        style={{ right: -12, top: '50%', background: '#10b981' }}
        className="!h-3 !w-3 !rounded-full !border-2 !border-[#161616]"
      />
    </div>
  )
})

CropImageNode.displayName = 'CropImageNode'
