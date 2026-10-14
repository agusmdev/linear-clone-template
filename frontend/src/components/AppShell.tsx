import * as React from 'react'
import { Menu } from 'lucide-react'
import { IconButton } from '@/components/IconButton'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'

interface AppShellProps {
  /** Usually <Sidebar />. Fixed 240px column on desktop, a sheet on small screens. */
  sidebar: React.ReactNode
  /** Usually <PageHeader />: the top bar of the main panel. */
  header?: React.ReactNode
  /** Page content; it scrolls inside the panel. */
  children: React.ReactNode
  /** Unread notifications: a dot on the "Open menu" button, the sidebar badge being hidden. */
  menuBadge?: number
}

/** App layout: sidebar on the left, an inset rounded main panel with a header and content. */
export function AppShell({ sidebar, header, children, menuBadge }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-sidebar text-foreground">
      <aside className="hidden w-60 shrink-0 md:flex">{sidebar}</aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">App navigation</SheetDescription>
          {/* A click on a link closes the sheet. */}
          <div className="h-full" onClickCapture={() => setMobileOpen(false)}>
            {sidebar}
          </div>
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-border-subtle bg-surface md:rounded-lg md:border">
          <div className="flex shrink-0 items-center md:block">
            <div className="relative ml-2 md:hidden">
              <IconButton
                label={menuBadge ? `Open menu (${menuBadge} unread notifications)` : 'Open menu'}
                icon={<Menu />}
                onClick={() => setMobileOpen(true)}
              />
              {menuBadge ? (
                <span
                  aria-hidden
                  data-testid="menu-unread-dot"
                  className="pointer-events-none absolute top-0.5 right-0.5 size-2 rounded-full bg-primary ring-2 ring-surface"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">{header}</div>
          </div>
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  )
}
