import { useEffect } from 'react'
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'

/**
 * Layout of `/<ws>/settings/...`. The workspace layout swaps the app sidebar
 * for the settings sidebar here; Esc goes back to the app (as in Linear).
 */
export const Route = createFileRoute('/_authed/$workspaceKey/settings')({
  component: SettingsLayout,
})

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

function SettingsLayout() {
  const { path } = useCurrentWorkspace()
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || isTyping(event.target)) return
      // An open dialog, menu or popover handles Esc itself.
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return
      navigate({ to: path('/my-issues') as '/' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, path])

  return <Outlet />
}
