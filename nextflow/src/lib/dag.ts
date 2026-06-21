import type { WorkflowNode, WorkflowEdge } from './types'

/**
 * Returns the direct upstream node IDs for a given node.
 */
export function getDependencies(nodeId: string, edges: WorkflowEdge[]): string[] {
  return edges
    .filter((e) => e.target === nodeId)
    .map((e) => e.source)
}

/**
 * Returns the direct downstream node IDs for a given node.
 */
export function getDescendants(nodeId: string, edges: WorkflowEdge[]): string[] {
  return edges
    .filter((e) => e.source === nodeId)
    .map((e) => e.target)
}

/**
 * Topological sort — returns node IDs in execution order.
 * Throws if a cycle is detected.
 */
export function topologicalSort(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): string[] {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const id of nodeIds) {
    inDegree.set(id, 0)
    adj.set(id, [])
  }

  for (const e of edges) {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      adj.get(e.source)!.push(e.target)
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
    }
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const result: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    result.push(id)
    for (const next of adj.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 0) - 1
      inDegree.set(next, deg)
      if (deg === 0) queue.push(next)
    }
  }

  if (result.length !== nodeIds.size) {
    throw new Error('Cycle detected in workflow graph')
  }

  return result
}

/**
 * Groups nodes into parallel levels.
 * All nodes in the same level can run concurrently.
 */
export function getParallelLevels(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): string[][] {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const id of nodeIds) {
    inDegree.set(id, 0)
    adj.set(id, [])
  }

  for (const e of edges) {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      adj.get(e.source)!.push(e.target)
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
    }
  }

  const levels: string[][] = []
  let current = [...nodeIds].filter((id) => inDegree.get(id) === 0)

  while (current.length > 0) {
    levels.push(current)
    const next: string[] = []
    for (const id of current) {
      for (const child of adj.get(id) ?? []) {
        const deg = (inDegree.get(child) ?? 0) - 1
        inDegree.set(child, deg)
        if (deg === 0) next.push(child)
      }
    }
    current = next
  }

  return levels
}

/**
 * Returns true if all direct dependencies of nodeId are in completedIds.
 */
export function isReady(
  nodeId: string,
  completedIds: Set<string>,
  edges: WorkflowEdge[],
): boolean {
  return getDependencies(nodeId, edges).every((dep) => completedIds.has(dep))
}

/**
 * Detects a cycle in the graph.
 * Returns true if a cycle exists.
 */
export function detectCycle(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): boolean {
  try {
    topologicalSort(nodes, edges)
    return false
  } catch {
    return true
  }
}
