'use client'

import { memo, useState } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Sparkles, Trash2, ChevronDown, ChevronRight, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/store/workflow-store'
import type { GeminiNodeData } from '@/lib/types'

const MODELS = [
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
]

export const GeminiNode = memo(({ id, data }: NodeProps<GeminiNodeData>) => {
  const { updateNodeData, deleteNode, executingNodeIds } = useWorkflowStore()
  const isExecuting = executingNodeIds.has(id)
  const [showSettings, setShowSettings] = useState(false)
  const [showResponse, setShowResponse] = useState(true)

  function update(patch: Partial<GeminiNodeData>) {
    updateNodeData(id, patch)
  }

  const promptConnected = Boolean(data.promptConnection)

  return (
    <div
      className={cn(
        'min-w-[300px] max-w-[340px] rounded-xl border border-[#2a2a2a] bg-[#161616] shadow-xl',
        isExecuting && 'node-executing',
      )}
    >
      {/* Input handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="handle-prompt-in"
        style={{ left: -12, top: '35%', background: '#a855f7' }}
        className="!h-3 !w-3 !rounded-full !border-2 !border-[#161616]"
        title="Prompt"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="handle-image-in"
        style={{ left: -12, top: '65%', background: '#10b981' }}
        className="!h-3 !w-3 !rounded-full !border-2 !border-[#161616]"
        title="Image (Vision)"
      />

      {/* Header */}
      <div className="flex items-center gap-2 rounded-t-xl border-b border-[#2a2a2a] bg-[#1e1e1e] px-3 py-2.5">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-violet-600/20">
          <Sparkles className="h-3 w-3 text-violet-400" />
        </div>
        <span className="text-xs font-semibold text-white">{data.label}</span>

        {/* Model selector */}
        <select
          value={data.model ?? 'gemini-1.5-pro'}
          onChange={(e) => update({ model: e.target.value })}
          className="ml-auto rounded bg-[#2a2a2a] px-1.5 py-0.5 text-[10px] text-zinc-400 outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer"
        >
          {MODELS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <button
          onClick={() => deleteNode(id)}
          className="text-zinc-600 hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-2">
        {/* System Prompt */}
        <div>
          <label className="mb-1 block text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
            System Prompt
          </label>
          <textarea
            className="w-full resize-none rounded bg-[#111] px-2 py-1.5 text-[11px] text-zinc-300 outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-violet-500/50"
            rows={2}
            value={data.systemPrompt ?? ''}
            onChange={(e) => update({ systemPrompt: e.target.value })}
            placeholder="You are a helpful assistant..."
          />
        </div>

        {/* Prompt */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
              Prompt
            </label>
            <div className={cn('flex items-center gap-1 text-[10px]', promptConnected ? 'text-violet-400' : 'text-zinc-600')}>
              {promptConnected ? '● Connected' : '○ Manual'}
            </div>
          </div>
          <textarea
            className={cn(
              'w-full resize-none rounded bg-[#111] px-2 py-1.5 text-[11px] text-zinc-300 outline-none focus:ring-1 focus:ring-violet-500/50',
              promptConnected && 'cursor-not-allowed opacity-40',
            )}
            rows={3}
            value={data.manualPrompt ?? ''}
            onChange={(e) => update({ manualPrompt: e.target.value })}
            placeholder={promptConnected ? 'Using connected input...' : 'Enter prompt...'}
            disabled={promptConnected}
          />
        </div>

        {/* Settings collapse */}
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="flex w-full items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          <Settings className="h-3 w-3" />
          Settings
          {showSettings ? <ChevronDown className="h-3 w-3 ml-auto" /> : <ChevronRight className="h-3 w-3 ml-auto" />}
        </button>

        {showSettings && (
          <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-2 text-[11px] text-zinc-500">
            Temperature, max tokens, etc. — coming soon
          </div>
        )}

        {/* Response output */}
        {data.response && (
          <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]">
            <button
              onClick={() => setShowResponse((v) => !v)}
              className="flex w-full items-center gap-1 px-2 py-1.5 text-[10px] font-medium text-zinc-400"
            >
              Response
              {showResponse ? <ChevronDown className="h-3 w-3 ml-auto" /> : <ChevronRight className="h-3 w-3 ml-auto" />}
            </button>
            {showResponse && (
              <div className="max-h-32 overflow-y-auto border-t border-[#2a2a2a] px-2 py-1.5">
                <p className="text-[11px] text-zinc-300 whitespace-pre-wrap">{data.response}</p>
              </div>
            )}
          </div>
        )}

        {data.isStreaming && (
          <div className="flex items-center gap-1.5 text-[11px] text-violet-400">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
            Generating...
          </div>
        )}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="handle-response-out"
        style={{ right: -12, top: '50%', background: '#a855f7' }}
        className="!h-3 !w-3 !rounded-full !border-2 !border-[#161616]"
        title="Response"
      />
    </div>
  )
})

GeminiNode.displayName = 'GeminiNode'
