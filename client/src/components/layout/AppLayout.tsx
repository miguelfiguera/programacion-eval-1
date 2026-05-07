import { Outlet } from 'react-router-dom'

import { AppNavbar } from '@/components/layout/AppNavbar'

/** Shell: fixed top navbar + routed main content. */
export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AppNavbar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
