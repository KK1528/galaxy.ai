import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface Params {
  params: Promise<{ runId: string }>
}

// GET /api/runs/[runId] — get a single run with node-level details
export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { runId } = await params

  const run = await prisma.workflowRun.findFirst({
    where: { id: runId, userId },
    include: {
      nodeRuns: {
        orderBy: { startedAt: 'asc' },
      },
    },
  })

  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(run)
}
