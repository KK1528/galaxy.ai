'use client'

import { BaseEdge, EdgeProps, getBezierPath } from 'reactflow'

export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      {/* Glow / shadow layer */}
      <BaseEdge
        id={`${id}-glow`}
        path={edgePath}
        style={{
          stroke: '#7c3aed',
          strokeWidth: 6,
          opacity: 0.25,
          filter: 'blur(3px)',
          ...style,
        }}
      />
      {/* Animated dash layer */}
      <path
        id={id}
        className="animated-edge-path"
        d={edgePath}
        fill="none"
        stroke="#a855f7"
        strokeWidth={2}
        markerEnd={markerEnd}
        style={style}
      />
    </>
  )
}
