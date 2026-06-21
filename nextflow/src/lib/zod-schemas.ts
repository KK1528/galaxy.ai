import { z } from 'zod'

// ─── Workflow ─────────────────────────────────────────────────────────────────

export const CreateWorkflowSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
})

export const SaveWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  graph: z
    .object({
      nodes: z.array(z.any()),
      edges: z.array(z.any()),
    })
    .optional(),
})

// ─── Run ──────────────────────────────────────────────────────────────────────

export const TriggerRunSchema = z.object({
  scope: z.enum(['full', 'partial', 'single']),
  nodeIds: z.array(z.string()).optional(),
  inputs: z.record(z.string(), z.string()).optional(),
})

// ─── Node field types ─────────────────────────────────────────────────────────

export const InputFieldSchema = z.object({
  id: z.string(),
  type: z.enum(['text_field', 'image_field']),
  label: z.string(),
  value: z.string(),
})

export const CropParamsSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
})

export type CreateWorkflowInput = z.infer<typeof CreateWorkflowSchema>
export type SaveWorkflowInput = z.infer<typeof SaveWorkflowSchema>
export type TriggerRunInput = z.infer<typeof TriggerRunSchema>
