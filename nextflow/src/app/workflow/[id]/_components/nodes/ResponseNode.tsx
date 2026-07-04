'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { HelpCircle, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/store/workflow-store'
import type { ResponseNodeData, ResponseSlot } from '@/lib/types'

export const ResponseNode = memo(({ id, data }: NodeProps<ResponseNodeData>) => {
  const { executingNodeIds } = useWorkflowStore()
  const isExecuting = executingNodeIds.has(id)

  // Use typed slots array; fall back gracefully for old saved graphs without slots
  const slots: ResponseSlot[] = data.slots?.length
    ? data.slots
    : data.result
      ? [{ label: 'result', value: data.result }]
      : [{ label: 'result', value: null }]

  return (
    <div
      className={cn(
        'w-[260px] rounded-xl border border-[#e8e8e8] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)]',
        isExecuting && 'node-executing',
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-[#f0f0f0]">
        <span className="flex-1 text-[13px] font-semibold text-[#1a1a2e]">{data.label}</span>
        <button title="Info" className="text-[#cccccc] hover:text-[#888888] transition-colors">
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Result slots — one per connected upstream node ── */}
      <div className="divide-y divide-[#f5f5f5]">
        {slots.map((slot, i) => (
          <div key={i} className="relative group px-3 py-2.5">
            {/* Each slot has its own target handle */}
            <Handle
              type="target"
              position={Position.Left}
              id={i === 0 ? 'handle-result-in' : `handle-result-in-${i}`}
              style={{
                left: -8,
                top: '50%',
                background: '#a78bfa',
                width: 10,
                height: 10,
                border: '2px solid white',
              }}
            />

            {/* Slot label + copy button */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" />
              <span className="flex-1 text-[12px] font-medium text-[#555555] truncate">
                {slot.label}
              </span>
              {slot.value && (
                <button
                  title="Copy output"
                  onClick={() => slot.value && navigator.clipboard.writeText(slot.value)}
                  className="flex h-5 w-5 items-center justify-center rounded text-[#cccccc] opacity-0 group-hover:opacity-100 hover:text-[#555555] transition-all"
                >
                  <Copy className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Output value or placeholder */}
            {slot.value ? (
              <div className="max-h-28 overflow-y-auto rounded-lg border border-[#eeeeee] bg-[#fafafa] px-2.5 py-2">
                <p className="text-[11px] text-[#333333] whitespace-pre-wrap leading-relaxed">
                  {slot.value}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-[#cccccc] pl-4">No output yet</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
})

ResponseNode.displayName = 'ResponseNode'
