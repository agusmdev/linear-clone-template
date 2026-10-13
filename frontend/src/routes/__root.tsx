import React, { useEffect, useState } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyDev<P = any>(factory: () => Promise<React.ComponentType<P>>): React.ComponentType<P> {
  return import.meta.env.DEV
    ? React.lazy(() => factory().then(c => ({ default: c })))
    : ((() => null) as React.ComponentType<P>)
}

const ReactQueryDevtools = lazyDev(() =>
  import('@tanstack/react-query-devtools').then(m => m.ReactQueryDevtools)
)
const TanStackDevtools = lazyDev(() =>
  import('@tanstack/react-devtools').then(m => m.TanStackDevtools)
)
const TanStackRouterDevtoolsPanel = lazyDev(() =>
  import('@tanstack/react-router-devtools').then(m => m.TanStackRouterDevtoolsPanel)
)

import { Layout } from '@/components/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { THEME_INIT_SCRIPT, ThemeProvider } from '@/contexts/ThemeContext'
import { initWebVitals } from '@/lib/web-vitals'

import appCss from '@/styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Linear Clone',
      },
      {
        name: 'theme-color',
        content: '#08090a',
      },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
})

function RootDocument() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  useEffect(() => {
    initWebVitals()
  }, [])

  return (
    // The theme class is set before paint by THEME_INIT_SCRIPT, so it can differ
    // from the server's "dark": suppressHydrationWarning covers that attribute.
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Static string from our code: applies the stored theme before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider queryClient={queryClient}>
              <TooltipProvider>
                <ErrorBoundary>
                  <Layout />
                </ErrorBoundary>
              </TooltipProvider>
              <Toaster />
              <React.Suspense>
                <ReactQueryDevtools initialIsOpen={false} />
                <TanStackDevtools
                  config={{
                    position: 'bottom-right',
                  }}
                  plugins={[
                    {
                      name: 'Tanstack Router',
                      render: <TanStackRouterDevtoolsPanel />,
                    },
                  ]}
                />
              </React.Suspense>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
