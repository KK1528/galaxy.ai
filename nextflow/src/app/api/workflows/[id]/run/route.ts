import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tasks, auth as triggerAuth } from '@trigger.dev/sdk'
import { TriggerRunSchema } from '@/lib/zod-schemas'
import type { runWorkflowTask } from '@/trigger/run-workflow'
import type { WorkflowNode, WorkflowEdge } from '@/lib/types'

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/workflows/[id]/run
export async function POST(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const workflow = await prisma.workflow.findFirst({ where: { id, userId } })
  if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = TriggerRunSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { scope, nodeIds, inputs = {} } = parsed.data
  const graph = workflow.graph as unknown as { nodes: WorkflowNode[]; edges: WorkflowEdge[] }

  // Create the WorkflowRun record
  const workflowRun = await prisma.workflowRun.create({
    data: {
      workflowId: id,
      userId,
      status: 'running',
      scope,
    },
  })

  // Fire the orchestrator task (non-blocking — returns immediately)
  const handle = await tasks.trigger<typeof runWorkflowTask>('run-workflow', {
    workflowRunId: workflowRun.id,
    workflowId: id,
    nodes: graph.nodes,
    edges: graph.edges,
    inputs,
    targetNodeIds: nodeIds,
  })

  // Generate a public access token so the client can subscribe to realtime updates
  const publicToken = await triggerAuth.createPublicToken({
    scopes: {
      read: {
        runs: [handle.id],
      },
    },
  })

  return NextResponse.json({
    runId: workflowRun.id,
    triggerRunId: handle.id,
    publicToken,
  })
}
