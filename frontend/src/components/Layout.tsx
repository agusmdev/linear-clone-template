import { Outlet, useMatches } from '@tanstack/react-router'
import { Navigation } from './Navigation'

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /**
     * Set `staticData: { appShell: true }` on a route (or a layout route) whose
     * pages render their own <AppShell>: the public top navigation is hidden there.
     */
    appShell?: boolean
  }
}

export function Layout() {
  const usesAppShell = useMatches({
    select: matches => matches.some(match => match.staticData?.appShell === true),
  })

  if (usesAppShell) return <Outlet />

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}
