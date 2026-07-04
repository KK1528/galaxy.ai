'use client'

import { useState } from 'react'
import { UserButton } from '@clerk/nextjs'
import { Plus, Zap, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AppSidebarProps {
  /** Highlight the Workflows nav item when on the dashboard */
  activeItem?: 'workflows'
  /** Called when the user clicks "+ New Workflow" */
  onNewWorkflow?: () => void
}

export function AppSidebar({ activeItem, onNewWorkflow }: AppSidebarProps) {
  const [open, setOpen] = useState(true)

  return (
    <aside
      className={cn(
        'relative flex shrink-0 flex-col border-r border-[#e8e8e8] bg-white transition-all duration-300 ease-in-out overflow-hidden',
        open ? 'w-56' : 'w-[52px]',
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex items-center border-b border-[#e8e8e8] px-3 py-[14px]',
          open ? 'gap-2.5' : 'justify-center',
        )}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600">
          <Zap className="h-4 w-4 text-white" />
        </div>
        {open && (
          <span className="truncate text-sm font-bold tracking-tight text-[#111111]">
            NextFlow
          </span>
        )}
      </div>

      {/* New Workflow button */}
      <div className={cn('pt-3', open ? 'px-3' : 'px-2')}>
        {open ? (
          <button
            onClick={onNewWorkflow}
            className="flex w-full items-center gap-2 rounded-lg bg-[#f0f0f0] px-3 py-2 text-sm font-medium text-[#333333] transition-colors hover:bg-[#e8e8e8]"
          >
            <Plus className="h-4 w-4 shrink-0 text-[#555555]" />
            New Workflow
          </button>
        ) : (
          <button
            onClick={onNewWorkflow}
            title="New Workflow"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f0f0f0] text-[#555555] transition-colors hover:bg-[#e8e8e8]"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className={cn('flex-1 space-y-0.5 pt-2', open ? 'p-3' : 'px-2 py-3')}>
        {open ? (
          <div
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2',
              activeItem === 'workflows' ? 'bg-violet-50' : 'hover:bg-[#f5f5f5]',
            )}
          >
            <LayoutGrid
              className={cn(
                'h-4 w-4 shrink-0',
                activeItem === 'workflows' ? 'text-violet-600' : 'text-[#888888]',
              )}
            />
            <span
              className={cn(
                'text-sm font-semibold',
                activeItem === 'workflows' ? 'text-violet-700' : 'text-[#555555]',
              )}
            >
              Workflows
            </span>
          </div>
        ) : (
          <button
            title="Workflows"
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg',
              activeItem === 'workflows' ? 'bg-violet-50' : 'hover:bg-[#f5f5f5]',
            )}
          >
            <LayoutGrid
              className={cn(
                'h-4 w-4',
                activeItem === 'workflows' ? 'text-violet-600' : 'text-[#888888]',
              )}
            />
          </button>
        )}
      </nav>

      {/* User + collapse toggle */}
      <div
        className={cn(
          'flex items-center border-t border-[#e8e8e8]',
          open ? 'justify-between px-4 py-3' : 'flex-col gap-2 px-2 py-3',
        )}
      >
        <UserButton />
        <button
          onClick={() => setOpen((v) => !v)}
          title={open ? 'Collapse sidebar' : 'Expand sidebar'}
          className="flex h-6 w-6 items-center justify-center rounded-md text-[#aaaaaa] transition-colors hover:bg-[#f0f0f0] hover:text-[#555555]"
        >
          {open
            ? <ChevronLeft className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  )
}
