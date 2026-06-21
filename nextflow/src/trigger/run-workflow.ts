import { task, tasks, metadata } from '@trigger.dev/sdk'
import { prisma } from '@/lib/prisma'
import { getDescendants, getDependencies, topologicalSort } from '@/lib/dag'
import type { WorkflowNode, WorkflowEdge, NodeData } from '@/lib/types'
import type { CropImagePayload } from './crop-image'
import type { GeminiPayload } from './gemini'

export interface RunWorkflowPayload {
  workflowRunId: string
  workflowId: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  // Runtime input values keyed by field id
  inputs: Record<string, string>
  // For partial/single runs — only execute these node IDs
  targetNodeIds?: string[]
}

export const runWorkflowTask = task({
  id: 'run-workflow',
  maxDuration: 600,

  run: async (payload: RunWorkflowPayload) => {
    const { workflowRunId, nodes, edges, inputs, targetNodeIds } = payload

    // ── Scope: filter to target nodes if partial/single run ───────────
    const activeNodes = targetNodeIds?.length
      ? nodes.filter((n) => targetNodeIds.includes(n.id))
      : nodes

    // ── Topological sort ──────────────────────────────────────────────
    let sortedIds: string[]
    try {
      sortedIds = topologicalSort(activeNodes, edges)
    } catch {
      await prisma.workflowRun.update({
        where: { id: workflowRunId },
        data: { status: 'failed', finishedAt: new Date() },
      })
      throw new Error('Cycle detected in workflow graph')
    }

    // ── Create NodeRun records for all active nodes ───────────────────
    const nodeRunMap = new Map<string, string>() // nodeId → nodeRunId

    for (const nodeId of sortedIds) {
      const node = activeNodes.find((n) => n.id === nodeId)!
      const data = node.data as NodeData
      const nodeRun = await prisma.nodeRun.create({
        data: {
          runId: workflowRunId,
          nodeId,
          nodeType: data.nodeType,
          nodeLabel: data.label,
          status: 'pending',
        },
      })
      nodeRunMap.set(nodeId, nodeRun.id)
    }

    // ── Fan-out execution: fire each node as soon as its deps are done ─
    const completed = new Set<string>()
    const failed = new Set<string>()
    // Map nodeId → result output
    const outputs = new Map<string, Record<string, unknown>>()

    // Nodes with no pending upstream deps can start immediately
    const pending = new Set(sortedIds)

    // Helper: check if a node is ready
    function isNodeReady(nodeId: string): boolean {
      const deps = getDependencies(nodeId, edges).filter((d) => pending.has(d) || sortedIds.includes(d))
      return deps.every((d) => completed.has(d))
    }

    // Helper: resolve input value for a handle — either from upstream
    // output or from the manual inputs map
    function resolveInput(nodeId: string, handleId: string): string | undefined {
      // Check if there's an edge connecting to this handle
      const incomingEdge = edges.find(
        (e) => e.target === nodeId && e.targetHandle === handleId,
      )
      if (incomingEdge) {
        const upstreamOutput = outputs.get(incomingEdge.source)
        if (upstreamOutput) {
          // Return the relevant field from upstream output
          return (
            (upstreamOutput['outputUrl'] as string | undefined) ??
            (upstreamOutput['response'] as string | undefined) ??
            String(Object.values(upstreamOutput)[0] ?? '')
          )
        }
      }
      // Fall back to manual input
      return inputs[handleId]
    }

    // Helper: resolve all image URLs connected to a node's image handles
    function resolveImageUrls(nodeId: string): string[] {
      const imageEdges = edges.filter(
        (e) => e.target === nodeId && e.targetHandle?.includes('image'),
      )
      return imageEdges
        .map((e) => {
          const out = outputs.get(e.source)
          return (out?.['outputUrl'] as string | undefined) ?? ''
        })
        .filter(Boolean)
    }

    // Trigger a single node as a background task
    async function fireNode(nodeId: string): Promise<void> {
      const node = activeNodes.find((n) => n.id === nodeId)!
      const data = node.data as NodeData
      const nodeRunId = nodeRunMap.get(nodeId)!

      try {
        if (data.nodeType === 'crop-image') {
          const inputImageUrl =
            resolveInput(nodeId, 'handle-image-in') ??
            inputs['image_field'] ??
            ''

          const cropPayload: CropImagePayload = {
            imageUrl: inputImageUrl,
            x: data.x ?? 0,
            y: data.y ?? 0,
            width: data.width ?? 100,
            height: data.height ?? 100,
            runId: workflowRunId,
            nodeRunId,
          }

          const result = await tasks.triggerAndWait<typeof import('./crop-image').cropImageTask>(
            'crop-image',
            cropPayload,
          )

          if (result.ok) {
            outputs.set(nodeId, { outputUrl: result.output.outputUrl })
            completed.add(nodeId)
          } else {
            throw new Error('crop-image task failed')
          }
        } else if (data.nodeType === 'gemini') {
          const prompt =
            resolveInput(nodeId, 'handle-prompt-in') ??
            data.manualPrompt ??
            ''
          const imageUrls = resolveImageUrls(nodeId)

          const geminiPayload: GeminiPayload = {
            prompt,
            systemPrompt: data.systemPrompt || undefined,
            imageUrls,
            model: data.model ?? 'gemini-1.5-pro',
            runId: workflowRunId,
            nodeRunId,
          }

          const result = await tasks.triggerAndWait<typeof import('./gemini').geminiTask>(
            'gemini',
            geminiPayload,
          )

          if (result.ok) {
            outputs.set(nodeId, { response: result.output.response })
            completed.add(nodeId)
          } else {
            throw new Error('gemini task failed')
          }
        } else {
          // request-inputs and response nodes resolve locally
          if (data.nodeType === 'request-inputs') {
            // Expose each field's value in the outputs map
            const fieldOutputs: Record<string, string> = {}
            for (const field of data.fields) {
              fieldOutputs[field.id] = inputs[field.id] ?? field.value ?? ''
            }
            outputs.set(nodeId, fieldOutputs)
          } else if (data.nodeType === 'response') {
            const resultValue =
              resolveInput(nodeId, 'handle-result-in') ?? ''
            outputs.set(nodeId, { result: resultValue })
          }

          // Mark as done with a quick DB write
          const finishedAt = new Date()
          await prisma.nodeRun.update({
            where: { id: nodeRunId },
            data: {
              status: 'success',
              output: (outputs.get(nodeId) ?? {}) as Record<string, string>,
              startedAt: finishedAt,
              finishedAt,
              duration: 0.1,
            },
          })
          completed.add(nodeId)
        }
      } catch (err) {
        failed.add(nodeId)
        await prisma.nodeRun.update({
          where: { id: nodeRunId },
          data: {
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
            finishedAt: new Date(),
          },
        })
      }

      pending.delete(nodeId)
    }

    // ── Execute with fan-out-on-completion ────────────────────────────
    // Run nodes concurrently whenever they become ready.
    // Use a simple polling loop with Promise.race to achieve
    // "fire a node as soon as its deps complete" semantics.

    const inFlight = new Map<string, Promise<void>>()

    while (pending.size > 0 || inFlight.size > 0) {
      // Start all newly-ready nodes
      for (const nodeId of [...pending]) {
        if (!inFlight.has(nodeId) && isNodeReady(nodeId)) {
          const p = fireNode(nodeId).then(() => { inFlight.delete(nodeId) })
          inFlight.set(nodeId, p)
        }
      }

      if (inFlight.size === 0) break  // deadlock guard

      // Wait for at least one to finish before re-evaluating
      await Promise.race(inFlight.values())
    }

    // ── Finalise WorkflowRun ──────────────────────────────────────────
    const finalStatus = failed.size === 0
      ? 'success'
      : failed.size < sortedIds.length
        ? 'partial'
        : 'failed'

    await prisma.workflowRun.update({
      where: { id: workflowRunId },
      data: { status: finalStatus, finishedAt: new Date() },
    })

    await metadata.set('status', finalStatus)

    return {
      status: finalStatus,
      completed: [...completed],
      failed: [...failed],
    }
  },
})
