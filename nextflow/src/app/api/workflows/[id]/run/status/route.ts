import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/workflows/[id]/run/status — latest run status for polling fallback
export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const workflow = await prisma.workflow.findFirst({ where: { id, userId } })
  if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const latestRun = await prisma.workflowRun.findFirst({
    where: { workflowId: id },
    orderBy: { startedAt: 'desc' },
    include: {
      nodeRuns: {
        orderBy: { startedAt: 'asc' },
      },
    },
  })

  return NextResponse.json(latestRun ?? null)
}
