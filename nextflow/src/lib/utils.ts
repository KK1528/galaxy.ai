import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a duration in seconds to a human-readable string, e.g. "31.8s" */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(0).padStart(2, '0')
  return `${m}m ${s}s`
}

/** Format a Date/ISO string to "Apr 25, 3:45 PM" */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Generate a simple unique label like "Gemini #2" */
export function makeNodeLabel(
  base: string,
  existingLabels: string[],
): string {
  let i = 1
  while (existingLabels.includes(`${base} #${i}`)) i++
  return `${base} #${i}`
}
