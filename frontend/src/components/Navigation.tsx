import { Link } from '@tanstack/react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const navLink =
  'rounded-md px-2 py-1 text-ui text-text-secondary transition-colors hover:text-foreground'

/** Product mark: a small indigo rounded square with a slash. */
export function AppMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('size-5', className)}>
      <rect width="24" height="24" rx="6" fill="var(--primary)" />
      <path d="M8 16.5 16 7.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

/** Public top bar (landing and auth pages, and pages without the app shell). */
export function Navigation() {
  const { isAuthenticated, logout } = useAuth()

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-ui font-semibold text-foreground"
            aria-label="Linear Clone"
          >
            <AppMark />
            <span className="hidden sm:inline">Linear Clone</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link to="/" className={navLink} activeProps={{ className: 'text-foreground' }}>
              Home
            </Link>
            {isAuthenticated && (
              <Link to="/items" className={navLink} activeProps={{ className: 'text-foreground' }}>
                Items
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <Button onClick={logout} variant="outline" size="sm">
              Logout
            </Button>
          ) : (
            <>
              <Link to="/login" className={navLink}>
                Login
              </Link>
              <Link to="/register" className={buttonVariants({ size: 'sm' })}>
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
