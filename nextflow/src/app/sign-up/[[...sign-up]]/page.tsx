'use client'

import { SignUp } from '@clerk/nextjs'
import { useLinkedInLog } from '@/hooks/useLinkedInLog'

export default function SignUpPage() {
  useLinkedInLog()

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f]">
      <SignUp />
    </div>
  )
}
