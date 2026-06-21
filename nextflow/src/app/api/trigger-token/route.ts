import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { auth as triggerAuth } from '@trigger.dev/sdk'

// POST /api/trigger-token — generate a short-lived public token for a run
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { runId } = await req.json() as { runId: string }
  if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 })

  const publicToken = await triggerAuth.createPublicToken({
    scopes: {
      read: {
        runs: [runId],
      },
    },
  })

  return NextResponse.json({ publicToken })
}
