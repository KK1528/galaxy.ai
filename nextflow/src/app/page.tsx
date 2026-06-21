import { redirect } from 'next/navigation'

// No marketing/home page — middleware will catch unauthenticated users,
// but if somehow they land here authenticated, send them to dashboard.
export default function RootPage() {
  redirect('/dashboard')
}
