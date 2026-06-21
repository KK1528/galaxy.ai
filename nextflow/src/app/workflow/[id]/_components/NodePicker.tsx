'use client'

import { useState } from 'react'
import { Search, X, Crop, Sparkles, ImageIcon, Mic, Video, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NodePickerItem {
  id: string
  label: string
  description: string
  category: 'image' | 'llm' | 'video' | 'audio' | 'other'
  icon: React.ReactNode
  functional: boolean
}

const ALL_NODES: NodePickerItem[] = [
  {
    id: 'crop-image',
    label: 'Crop Image',
    description: 'Crop an image to specific dimensions using FFmpeg',
    category: 'image',
    icon: <Crop className="h-4 w-4 text-emerald-400" />,
    functional: true,
  },
  {
    id: 'gemini',
    label: 'Gemini 1.5 Pro',
    description: 'Google Gemini multimodal LLM with vision support',
    category: 'llm',
    icon: <Sparkles className="h-4 w-4 text-violet-400" />,
    functional: true,
  },
  {
    id: 'image-resize',
    label: 'Resize Image',
    description: 'Resize an image to a specific size',
    category: 'image',
    icon: <ImageIcon className="h-4 w-4 text-zinc-500" />,
    functional: false,
  },
  {
    id: 'video-trim',
    label: 'Trim Video',
    description: 'Trim a video to a specific duration',
    category: 'video',
    icon: <Video className="h-4 w-4 text-zinc-500" />,
    functional: false,
  },
  {
    id: 'audio-transcribe',
    label: 'Transcribe Audio',
    description: 'Transcribe audio to text using Whisper',
    category: 'audio',
    icon: <Mic className="h-4 w-4 text-zinc-500" />,
    functional: false,
  },
  {
    id: 'extract-text',
    label: 'Extract Text',
    description: 'Extract text from a PDF or document',
    category: 'other',
    icon: <FileText className="h-4 w-4 text-zinc-500" />,
    functional: false,
  },
]

const CATEGORIES = ['All', 'Image', 'LLM', 'Video', 'Audio', 'Other'] as const
type Category = (typeof CATEGORIES)[number]

interface NodePickerProps {
  onSelect: (nodeType: string) => void
  onClose: () => void
}

export function NodePicker({ onSelect, onClose }: NodePickerProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('All')

  const filtered = ALL_NODES.filter((n) => {
    const matchesSearch =
      n.label.toLowerCase().includes(search.toLowerCase()) ||
      n.description.toLowerCase().includes(search.toLowerCase())
    const matchesCategory =
      activeCategory === 'All' ||
      n.category === activeCategory.toLowerCase()
    return matchesSearch && matchesCategory
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-20" onClick={onClose}>
      <div
        className="w-[480px] rounded-2xl border border-[#2a2a2a] bg-[#161616] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center gap-2 border-b border-[#2a2a2a] px-4 py-3">
          <Search className="h-4 w-4 text-zinc-500 shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-sm text-zinc-300 outline-none placeholder:text-zinc-600"
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-[#2a2a2a] px-4 py-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                activeCategory === cat
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Node list */}
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-600">No nodes found</p>
          ) : (
            filtered.map((node) => (
              <button
                key={node.id}
                onClick={() => node.functional && onSelect(node.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                  node.functional
                    ? 'hover:bg-[#222] cursor-pointer'
                    : 'cursor-not-allowed opacity-40',
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#222]">
                  {node.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-200">{node.label}</p>
                    {!node.functional && (
                      <span className="rounded bg-[#2a2a2a] px-1.5 py-0.5 text-[9px] text-zinc-600">
                        SOON
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-zinc-500">{node.description}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
