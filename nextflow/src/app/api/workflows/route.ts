import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CreateWorkflowSchema } from '@/lib/zod-schemas'
import type { WorkflowNode, WorkflowEdge } from '@/lib/types'

// Default graph seeded on every new workflow
function defaultGraph(): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  return {
    nodes: [
      {
        id: 'request-inputs-1',
        type: 'requestInputs',
        position: { x: 80, y: 200 },
        data: {
          nodeType: 'request-inputs',
          label: 'Request Inputs',
          fields: [],
        },
        deletable: false,
      },
      {
        id: 'response-1',
        type: 'response',
        position: { x: 900, y: 200 },
        data: {
          nodeType: 'response',
          label: 'Response',
          resultConnection: null,
          result: null,
          slots: [{ label: 'result', value: null }],
        },
        deletable: false,
      },
    ],
    edges: [],
  }
}

// GET /api/workflows — list user's workflows
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workflows = await prisma.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      runs: {
        orderBy: { startedAt: 'desc' },
        take: 1,
        select: { status: true },
      },
    },
  })

  return NextResponse.json(workflows)
}

// POST /api/workflows — create a new workflow
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateWorkflowSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const workflow = await prisma.workflow.create({
    data: {
      userId,
      name: parsed.data.name,
      graph: defaultGraph() as unknown as import('@prisma/client').Prisma.InputJsonValue,
    },
  })

  return NextResponse.json(workflow, { status: 201 })
}
