'use client'

import { SignIn } from '@clerk/nextjs'
import { useLinkedInLog } from '@/hooks/useLinkedInLog'

export default function SignInPage() {
  useLinkedInLog()

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f]">
      <SignIn />
    </div>
  )
}
