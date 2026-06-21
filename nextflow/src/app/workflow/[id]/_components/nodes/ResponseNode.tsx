'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { ArrowDownToLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/store/workflow-store'
import type { ResponseNodeData } from '@/lib/types'

export const ResponseNode = memo(({ id, data }: NodeProps<ResponseNodeData>) => {
  const { executingNodeIds } = useWorkflowStore()
  const isExecuting = executingNodeIds.has(id)

  return (
    <div
      className={cn(
        'min-w-[260px] max-w-[320px] rounded-xl border border-[#2a2a2a] bg-[#161616] shadow-xl',
        isExecuting && 'node-executing',
      )}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="handle-result-in"
        style={{ left: -12, top: '50%', background: '#a855f7' }}
        className="!h-3 !w-3 !rounded-full !border-2 !border-[#161616]"
      />

      {/* Header */}
      <div className="flex items-center gap-2 rounded-t-xl border-b border-[#2a2a2a] bg-[#1e1e1e] px-3 py-2.5">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-600/20">
          <ArrowDownToLine className="h-3 w-3 text-blue-400" />
        </div>
        <span className="text-xs font-semibold text-white">{data.label}</span>
        <span className="ml-auto rounded bg-[#2a2a2a] px-1.5 py-0.5 text-[10px] text-zinc-400">
          OUTPUT
        </span>
      </div>

      {/* Result display */}
      <div className="p-3">
        {data.result ? (
          <div className="rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 max-h-48 overflow-y-auto">
            <p className="text-[11px] text-zinc-300 whitespace-pre-wrap">{data.result}</p>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-[#2a2a2a] py-6">
            <p className="text-[11px] text-zinc-600">
              {data.resultConnection ? 'Awaiting result...' : 'Connect a response handle'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
})

ResponseNode.displayName = 'ResponseNode'
