import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SaveWorkflowSchema } from '@/lib/zod-schemas'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/workflows/[id]
export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const workflow = await prisma.workflow.findFirst({
    where: { id, userId },
  })

  if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(workflow)
}

// PUT /api/workflows/[id] — save graph or rename
export async function PUT(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const body = await req.json()
  const parsed = SaveWorkflowSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await prisma.workflow.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const workflow = await prisma.workflow.update({
    where: { id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.graph ? { graph: parsed.data.graph } : {}),
    },
  })

  return NextResponse.json(workflow)
}

// DELETE /api/workflows/[id]
export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.workflow.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.workflow.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
