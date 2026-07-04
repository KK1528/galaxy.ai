'use client'

import { useState } from 'react'
import { Search, X, Crop, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NodePickerItem {
  id: string
  label: string
  description: string
  category: 'image' | 'llm'
  icon: React.ReactNode
}

const ALL_NODES: NodePickerItem[] = [
  {
    id: 'crop-image',
    label: 'Crop Image',
    description: 'Crop an image to specific dimensions using FFmpeg',
    category: 'image',
    icon: <Crop className="h-4 w-4 text-emerald-500" />,
  },
  {
    id: 'gemini',
    label: 'Gemini 1.5 Pro',
    description: 'Google Gemini multimodal LLM with vision support',
    category: 'llm',
    icon: <Sparkles className="h-4 w-4 text-violet-600" />,
  },
]

const CATEGORIES = ['All', 'Image', 'LLM'] as const
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
        className="w-[480px] rounded-2xl border border-[#e8e8e8] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center gap-2 border-b border-[#e8e8e8] px-4 py-3">
          <Search className="h-4 w-4 text-[#aaaaaa] shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-sm text-[#111111] outline-none placeholder:text-[#aaaaaa]"
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={onClose} className="text-[#aaaaaa] hover:text-[#555555] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-[#e8e8e8] px-4 py-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                activeCategory === cat
                  ? 'bg-violet-600 text-white'
                  : 'text-[#888888] hover:text-[#333333] hover:bg-[#f5f5f5]',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Node list */}
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#aaaaaa]">No nodes found</p>
          ) : (
            filtered.map((node) => (
              <button
                key={node.id}
                onClick={() => onSelect(node.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[#f8f8f8] cursor-pointer"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f5f5f5]">
                  {node.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#111111]">{node.label}</p>
                  <p className="truncate text-xs text-[#888888]">{node.description}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
