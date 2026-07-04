import { PrismaClient } from '@prisma/client'
import type {
  WorkflowNode,
  WorkflowEdge,
  RequestInputsNodeData,
  CropImageNodeData,
  GeminiNodeData,
  ResponseNodeData,
} from '../src/lib/types'

const prisma = new PrismaClient()

// ── Node IDs (stable so edges reference them correctly) ───────────────────────
const IDS = {
  requestInputs: 'seed-request-inputs',
  crop1:         'seed-crop-1',
  crop2:         'seed-crop-2',
  gemini1:       'seed-gemini-1',
  gemini2:       'seed-gemini-2',
  gemini3:       'seed-gemini-3',
  response:      'seed-response',
}

// ── Nodes ─────────────────────────────────────────────────────────────────────
const nodes: WorkflowNode[] = [
  // 1. Request Inputs
  {
    id: IDS.requestInputs,
    type: 'requestInputs',
    position: { x: 60, y: 260 },
    deletable: false,
    data: {
      nodeType: 'request-inputs',
      label: 'Request Inputs',
      fields: [
        {
          id: 'field-text',
          type: 'text_field',
          label: 'text_field',
          value:
            'Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.',
        },
        {
          id: 'field-image',
          type: 'image_field',
          label: 'image_field',
          value: '',
        },
      ],
    } satisfies RequestInputsNodeData,
  },

  // 2. Crop Image #1 — tight product crop
  {
    id: IDS.crop1,
    type: 'cropImage',
    position: { x: 440, y: 80 },
    data: {
      nodeType: 'crop-image',
      label: 'Crop Image #1',
      inputImageConnection: `${IDS.requestInputs}:field-field-image`,
      x: 20,
      y: 20,
      width: 60,
      height: 60,
    } satisfies CropImageNodeData,
  },

  // 3. Crop Image #2 — wide banner crop
  {
    id: IDS.crop2,
    type: 'cropImage',
    position: { x: 440, y: 320 },
    data: {
      nodeType: 'crop-image',
      label: 'Crop Image #2',
      inputImageConnection: `${IDS.requestInputs}:field-field-image`,
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    } satisfies CropImageNodeData,
  },

  // 4. Gemini #1 — marketing copywriter
  {
    id: IDS.gemini1,
    type: 'gemini',
    position: { x: 440, y: 540 },
    data: {
      nodeType: 'gemini',
      label: 'Gemini #1',
      model: 'gemini-1.5-pro',
      systemPrompt:
        'You are a marketing copywriter. Write a one-paragraph product description.',
      promptConnection: `${IDS.requestInputs}:field-field-text`,
      imageConnections: [],
      manualPrompt: '',
      response: null,
      isStreaming: false,
    } satisfies GeminiNodeData,
  },

  // 5. Gemini #2 — tweet hook condenser
  {
    id: IDS.gemini2,
    type: 'gemini',
    position: { x: 800, y: 540 },
    data: {
      nodeType: 'gemini',
      label: 'Gemini #2',
      model: 'gemini-1.5-pro',
      systemPrompt:
        'Condense the following product description into a tweet-length hook (under 240 characters).',
      promptConnection: `${IDS.gemini1}:handle-response-out`,
      imageConnections: [],
      manualPrompt: '',
      response: null,
      isStreaming: false,
    } satisfies GeminiNodeData,
  },

  // 6. Gemini #3 (Final) — social media manager
  {
    id: IDS.gemini3,
    type: 'gemini',
    position: { x: 1160, y: 300 },
    data: {
      nodeType: 'gemini',
      label: 'Gemini #3 (Final)',
      model: 'gemini-1.5-pro',
      systemPrompt:
        'You are a social media manager. Combine the tweet hook and the two product crops into a final marketing post.',
      promptConnection: `${IDS.gemini2}:handle-response-out`,
      imageConnections: [
        `${IDS.crop1}:handle-image-out`,
        `${IDS.crop2}:handle-image-out`,
      ],
      manualPrompt: '',
      response: null,
      isStreaming: false,
    } satisfies GeminiNodeData,
  },

  // 7. Response
  {
    id: IDS.response,
    type: 'response',
    position: { x: 1520, y: 300 },
    deletable: false,
    data: {
      nodeType: 'response',
      label: 'Response',
      resultConnection: `${IDS.gemini3}:handle-response-out`,
      result: null,
      slots: [{ label: 'result', value: null }],
    } satisfies ResponseNodeData,
  },
]

// ── Edges ─────────────────────────────────────────────────────────────────────
const edges: WorkflowEdge[] = [
  // Request-Inputs.image_field → Crop #1.Input Image
  {
    id: 'e-img-crop1',
    source: IDS.requestInputs,
    sourceHandle: 'field-field-image',
    target: IDS.crop1,
    targetHandle: 'handle-image-in',
    type: 'animated',
  },
  // Request-Inputs.image_field → Crop #2.Input Image
  {
    id: 'e-img-crop2',
    source: IDS.requestInputs,
    sourceHandle: 'field-field-image',
    target: IDS.crop2,
    targetHandle: 'handle-image-in',
    type: 'animated',
  },
  // Request-Inputs.text_field → Gemini #1.Prompt
  {
    id: 'e-txt-g1',
    source: IDS.requestInputs,
    sourceHandle: 'field-field-text',
    target: IDS.gemini1,
    targetHandle: 'handle-prompt-in',
    type: 'animated',
  },
  // Gemini #1.Response → Gemini #2.Prompt
  {
    id: 'e-g1-g2',
    source: IDS.gemini1,
    sourceHandle: 'handle-response-out',
    target: IDS.gemini2,
    targetHandle: 'handle-prompt-in',
    type: 'animated',
  },
  // Crop #1.Output Image → Final Gemini.Image (Vision)
  {
    id: 'e-crop1-g3',
    source: IDS.crop1,
    sourceHandle: 'handle-image-out',
    target: IDS.gemini3,
    targetHandle: 'handle-image-in',
    type: 'animated',
  },
  // Crop #2.Output Image → Final Gemini.Image (Vision)
  {
    id: 'e-crop2-g3',
    source: IDS.crop2,
    sourceHandle: 'handle-image-out',
    target: IDS.gemini3,
    targetHandle: 'handle-image-in',
    type: 'animated',
  },
  // Gemini #2.Response → Final Gemini.Prompt
  {
    id: 'e-g2-g3',
    source: IDS.gemini2,
    sourceHandle: 'handle-response-out',
    target: IDS.gemini3,
    targetHandle: 'handle-prompt-in',
    type: 'animated',
  },
  // Final Gemini.Response → Response.result
  {
    id: 'e-g3-resp',
    source: IDS.gemini3,
    sourceHandle: 'handle-response-out',
    target: IDS.response,
    targetHandle: 'handle-result-in',
    type: 'animated',
  },
]

// ── Seed ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱  Seeding sample workflow...')

  // Check if already seeded
  const existing = await prisma.workflow.findFirst({
    where: { name: 'Marketing Campaign Workflow' },
  })

  if (existing) {
    console.log('✅  Sample workflow already exists — skipping.')
    console.log(`    ID: ${existing.id}`)
    return
  }

  // Find the first user to attach it to, or use a placeholder
  // In production this runs after first sign-in; userId can be updated manually.
  const SEED_USER_ID = process.env.SEED_USER_ID ?? 'seed-placeholder-user'

  const workflow = await prisma.workflow.create({
    data: {
      userId: SEED_USER_ID,
      name: 'Marketing Campaign Workflow',
      graph: { nodes, edges } as unknown as import('@prisma/client').Prisma.InputJsonValue,
    },
  })

  console.log('✅  Created "Marketing Campaign Workflow"')
  console.log(`    ID:      ${workflow.id}`)
  console.log(`    User ID: ${SEED_USER_ID}`)
  console.log('')
  console.log('💡  To attach to your account, set SEED_USER_ID=<your-clerk-user-id> in .env')
  console.log('    and re-run: npx prisma db seed')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
