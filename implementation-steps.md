# NextFlow — Implementation Steps

---

## Step 1 — Project Scaffold

```bash
npx create-next-app@latest nextflow --typescript --tailwind --app --src-dir
cd nextflow
```

Install all dependencies at once:

```bash
npm install @clerk/nextjs @prisma/client prisma @trigger.dev/sdk @trigger.dev/nextjs reactflow zustand zod @google/generative-ai lucide-react @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tooltip class-variance-authority clsx tailwind-merge

npm install -D @types/node
```

Set up `tsconfig.json` with `"strict": true` — verify it's already there from the Next.js scaffold.

Create `.env.local`:
```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Neon PostgreSQL
DATABASE_URL=

# Trigger.dev
TRIGGER_API_KEY=
TRIGGER_API_URL=https://api.trigger.dev
NEXT_PUBLIC_TRIGGER_PUBLIC_API_KEY=

# Google Gemini
GOOGLE_AI_API_KEY=

# Transloadit
TRANSLOADIT_KEY=
TRANSLOADIT_SECRET=
NEXT_PUBLIC_TRANSLOADIT_KEY=
```

---

## Step 2 — Prisma Schema

```bash
npx prisma init
```

`prisma/schema.prisma`:
```prisma
model Workflow {
  id          String        @id @default(cuid())
  userId      String
  name        String
  graph       Json          // nodes + edges serialized
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  runs        WorkflowRun[]
}

model WorkflowRun {
  id          String      @id @default(cuid())
  workflowId  String
  workflow    Workflow    @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  userId      String
  status      String      // "running" | "success" | "failed" | "partial"
  scope       String      // "full" | "partial" | "single"
  startedAt   DateTime    @default(now())
  finishedAt  DateTime?
  nodeRuns    NodeRun[]
}

model NodeRun {
  id          String      @id @default(cuid())
  runId       String
  run         WorkflowRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  nodeId      String
  nodeType    String
  nodeLabel   String
  status      String      // "pending" | "running" | "success" | "failed"
  inputs      Json?
  output      Json?
  error       String?
  startedAt   DateTime?
  finishedAt  DateTime?
  duration    Float?      // seconds
}
```

```bash
npx prisma db push
npx prisma generate
```

---

## Step 3 — Clerk Auth Setup

`src/middleware.ts`:
```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) auth().protect()
})

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)']
}
```

App Router layout:
```
src/app/
  layout.tsx               ← ClerkProvider wraps everything
  sign-in/[[...sign-in]]/page.tsx
  sign-up/[[...sign-up]]/page.tsx
  dashboard/page.tsx
  workflow/[id]/page.tsx
```

`src/app/layout.tsx` — wrap with `<ClerkProvider>` and add the `console.log` requirement:
```ts
// Every page's client component does this on mount:
useEffect(() => {
  console.log('[NextFlow] Candidate LinkedIn: https://linkedin.com/in/yourprofile')
}, [])
```

Put this in a `useLinkedInLog` hook and call it from every page component.

---

## Step 4 — Folder Structure

```
src/
  app/
    (auth)/
      sign-in/[[...sign-in]]/page.tsx
      sign-up/[[...sign-up]]/page.tsx
    dashboard/
      page.tsx
      _components/
        WorkflowCard.tsx
        CreateWorkflowDialog.tsx
        RenameDialog.tsx
        DeleteDialog.tsx
    workflow/
      [id]/
        page.tsx
        _components/
          Canvas.tsx
          NodePicker.tsx
          HistoryPanel.tsx
          nodes/
            RequestInputsNode.tsx
            CropImageNode.tsx
            GeminiNode.tsx
            ResponseNode.tsx
          edges/
            AnimatedEdge.tsx
    api/
      workflows/
        route.ts                  ← GET list, POST create
        [id]/
          route.ts                ← GET, PUT, DELETE
          run/
            route.ts              ← POST trigger execution
            status/
              route.ts            ← GET run status
  lib/
    prisma.ts                     ← singleton Prisma client
    dag.ts                        ← topological sort + parallel resolver
    types.ts                      ← all shared TypeScript types
    zod-schemas.ts                ← all Zod schemas
    utils.ts                      ← cn(), etc.
  store/
    workflow-store.ts             ← Zustand canvas state
    history-store.ts              ← Zustand history panel state
  trigger/
    crop-image.ts                 ← Trigger.dev task
    gemini.ts                     ← Trigger.dev task
    run-workflow.ts               ← orchestrator task
```

---

## Step 5 — Zustand Store

`src/store/workflow-store.ts` — manages:
- `nodes: Node[]` — React Flow nodes
- `edges: Edge[]` — React Flow edges
- `past: Snapshot[]` — undo stack
- `future: Snapshot[]` — redo stack
- `executingNodeIds: Set<string>` — drives pulsating glow
- Actions: `addNode`, `updateNode`, `deleteNode`, `addEdge`, `deleteEdge`, `undo`, `redo`, `setExecuting`

Use Zustand's `temporal` middleware or manually snapshot before each mutation for undo/redo.

---

## Step 6 — Trigger.dev Tasks

`src/trigger/crop-image.ts`:
```ts
import { task } from '@trigger.dev/sdk/v3'

export const cropImageTask = task({
  id: 'crop-image',
  run: async (payload: {
    imageUrl: string
    x: number; y: number; width: number; height: number
    runId: string; nodeRunId: string
  }) => {
    // Update nodeRun status → "running"

    // MANDATORY: 30+ second artificial delay
    await new Promise(resolve => setTimeout(resolve, 31000))

    // FFmpeg crop via Transloadit assembly
    // ... assemble + poll + get result URL

    // Update nodeRun status → "success", store output URL
    return { outputUrl: '...' }
  }
})
```

`src/trigger/gemini.ts`:
```ts
import { task } from '@trigger.dev/sdk/v3'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const geminiTask = task({
  id: 'gemini',
  run: async (payload: {
    prompt: string
    systemPrompt?: string
    imageUrls?: string[]
    model?: string
    runId: string; nodeRunId: string
  }) => {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: payload.model ?? 'gemini-1.5-pro' })
    // ... build parts array with text + inline images
    // ... call generateContent
    // Update nodeRun, return response text
  }
})
```

`src/trigger/run-workflow.ts` — the DAG orchestrator:
```ts
// 1. Topological sort nodes
// 2. Group into parallel levels
// 3. For each level, trigger all tasks concurrently with triggerAndWait
// 4. As each node completes, immediately check if any dependent
//    is now unblocked (all its inputs satisfied) and fire it
//    — don't wait for the full level to finish
// 5. Update WorkflowRun status throughout
```

---

## Step 7 — DAG Resolver

`src/lib/dag.ts` — this is core logic:

```ts
// topologicalSort(nodes, edges) → string[] (ordered node IDs)
// getParallelLevels(nodes, edges) → string[][] (concurrent groups)
// getDependencies(nodeId, edges) → string[] (direct upstream IDs)
// isReady(nodeId, completedIds, edges) → boolean
// detectCycle(nodes, edges) → boolean
```

The parallel execution must be "fan-out on completion" not "wait for level" — when node A finishes,
immediately check all its children and fire any whose other dependencies are also done.

---

## Step 8 — API Routes

All routes use Zod validation and Clerk `auth()` to scope to the current user.

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/workflows` | List user's workflows |
| POST | `/api/workflows` | Create workflow (name + default graph) |
| GET | `/api/workflows/[id]` | Load full workflow + graph |
| PUT | `/api/workflows/[id]` | Save graph / rename |
| DELETE | `/api/workflows/[id]` | Delete workflow |
| POST | `/api/workflows/[id]/run` | Trigger execution (`{ scope, nodeIds? }`) |
| GET | `/api/workflows/[id]/runs` | List run history |
| GET | `/api/runs/[runId]` | Get run + node-level details |

---

## Step 9 — React Flow Canvas

**Custom node components** — each needs:
- Matching Galaxy.ai visual style (dark card, rounded, colored handle dots)
- `NodeResizer` if needed
- Source/target handles with typed IDs (e.g., `handle-image-out`, `handle-text-in`)
- Pulsating glow class applied when `nodeId` is in `executingNodeIds`

**Connection validation** (`isValidConnection` prop on ReactFlow):
```ts
const isValidConnection = (connection) => {
  // Check source handle type matches target handle type
  // Reject image→text, text→image, etc.
  // Also check DAG — would this create a cycle?
}
```

**Edge type** — custom `AnimatedEdge` with purple stroke and flowing dash animation via CSS.

**Bottom toolbar** — fixed position floating bar with `+` button that opens the node picker modal.

**Node picker modal** — searchable, categories: Recent / Image / Video / Audio / Others.
Only Crop Image and Gemini 3.1 Pro are functional.

---

## Step 10 — Dashboard Page

```
/dashboard
  ← WorkflowList (table or card grid)
      ← WorkflowRow: name | last edited | status badge | [Open] [Rename] [Delete]
  ← CreateWorkflowButton → POST /api/workflows → redirect to /workflow/[id]
  ← EmptyState (when no workflows)
```

Match Galaxy.ai sidebar + layout exactly. On create, seed the default graph
(Request-Inputs + Response nodes at their default positions).

---

## Step 11 — History Panel

Right sidebar on the canvas page. Driven by polling or Trigger.dev Realtime.

```
WorkflowRun list
  └── RunRow: #123 | Apr 25 3:45PM | ✅ success | 32.1s | Full
        └── (expanded) NodeRunList
              └── NodeRunRow: Crop Image #1 | ✅ | 31.8s | output URL
```

Color-coded badges:
- 🟢 Green = success
- 🔴 Red = failed
- 🟡 Yellow = partial / running

---

## Step 12 — Real-time Pulsating Glow

Use **Trigger.dev Realtime** to stream task status back to the client:

```ts
// In the Trigger.dev task, emit events:
await metadata.set('status', 'running')

// On the client, subscribe:
useRealtimeRun(runId, {
  onUpdate: (run) => {
    store.setExecuting(nodeId, run.status === 'EXECUTING')
  }
})
```

Apply Tailwind animation to executing nodes:
```css
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0px rgba(168, 85, 247, 0); }
  50%       { box-shadow: 0 0 20px rgba(168, 85, 247, 0.8); }
}
.node-executing {
  animation: pulse-glow 1.5s ease-in-out infinite;
}
```

---

## Step 13 — Sample Workflow Seed

Create a seed script `prisma/seed.ts` that:
1. Creates a workflow named "Marketing Campaign Workflow"
2. Builds the exact 7-node graph with correct positions and edges from the spec
3. Associates it with a known test user ID (or runs after first sign-in)

Node layout from spec:

| # | Type | Notes |
|---|------|-------|
| 1 | Request-Inputs | text_field + image_field |
| 2 | Crop Image #1 | x=20, y=20, w=60, h=60 |
| 3 | Crop Image #2 | x=0, y=0, w=100, h=50 |
| 4 | Gemini #1 | System: marketing copywriter. Prompt ← text_field |
| 5 | Gemini #2 | System: tweet hook condenser. Prompt ← Gemini #1.Response |
| 6 | Gemini #3 (Final) | System: social media manager. Prompt ← Gemini #2, Images ← Crop #1 + #2 |
| 7 | Response | result ← Final Gemini.Response |

Edges:
- Request-Inputs.image_field → Crop #1.Input Image, Crop #2.Input Image
- Request-Inputs.text_field → Gemini #1.Prompt
- Gemini #1.Response → Gemini #2.Prompt
- Crop #1.Output Image, Crop #2.Output Image → Final Gemini.Image (Vision)
- Gemini #2.Response → Final Gemini.Prompt
- Final Gemini.Response → Response.result

```bash
npx prisma db seed
```

---

## Step 14 — Export / Import JSON

**Export:** serialize `{ nodes, edges, metadata }` → download as `.json`

**Import:** file picker → parse + validate with Zod → load into canvas store → save to DB

---

## Step 15 — Deploy to Vercel

```bash
vercel --prod
```

Checklist:
- [ ] Set all env vars in Vercel dashboard
- [ ] Add `TRIGGER_SECRET_KEY` for webhook verification
- [ ] Run `npx prisma db push` against Neon production URL
- [ ] Set Clerk production instance URLs
- [ ] Verify Trigger.dev webhook endpoint is reachable at `/api/trigger`
- [ ] Smoke test full sample workflow end-to-end
- [ ] Verify 30s delay on Crop Image in production
- [ ] Record 3–5 min demo video

---

## Build Order Summary

| Day | Time | Focus |
|-----|------|-------|
| Day 1 | AM | Scaffold + Clerk + Prisma + env + smoke test Trigger.dev + Transloadit |
| Day 1 | PM | API routes + DB layer + Dashboard page |
| Day 2 | AM | React Flow canvas + custom nodes + Zustand store + node picker |
| Day 2 | PM | Trigger.dev tasks (Crop + Gemini) + DAG resolver + parallel execution |
| Day 3 | AM | History panel + real-time glow + selective execution |
| Day 3 | PM | Sample workflow seed + export/import + pixel-perfect polish + deploy |

---

## Critical "Don't Miss" Checklist

- [ ] 30+ second artificial delay on Crop Image — hard requirement
- [ ] No marketing/home page — unauthenticated → straight to Clerk
- [ ] Every LLM + Crop execution runs as a Trigger.dev task (no direct API calls)
- [ ] `console.log('[NextFlow] Candidate LinkedIn: <url>')` on every page initial client render
- [ ] Request-Inputs and Response nodes cannot be deleted
- [ ] Parallel execution: Crop #1, Crop #2, Gemini #1 all start at T=0
- [ ] Gemini #2 fires as soon as Gemini #1 finishes — does not wait for Crops
- [ ] Sample workflow pre-built with exact node placement and edge routing
- [ ] Type-safe handle connections (image ↔ text rejection)
- [ ] Connected inputs greyed out / disabled
- [ ] DAG cycle detection
- [ ] Undo/Redo working on canvas
- [ ] Workflow + history persisted to PostgreSQL
- [ ] Export/Import JSON working
- [ ] Deployed on Vercel with live URL

---

## Highest-Risk Items — Validate on Day 1

1. **Trigger.dev task execution** — get a hello-world task firing before building UI
2. **Transloadit + FFmpeg assembly** — test a real crop before wiring it into nodes
3. **Trigger.dev Realtime** — confirm status streaming works in the browser
4. **Neon + Prisma connection** — verify DB push + generate works cleanly

If any of these pipelines have issues, you need to know on Day 1, not Day 3.
