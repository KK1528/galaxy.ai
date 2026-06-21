'use client'

import { useEffect } from 'react'

/**
 * Emits a single console.log on every page's initial client render
 * so the submission can be attributed.
 */
export function useLinkedInLog() {
  useEffect(() => {
    console.log('[NextFlow] Candidate LinkedIn: https://www.linkedin.com/in/krishna-chaitanya-5b5b5b5b5b/')
  }, [])
}
