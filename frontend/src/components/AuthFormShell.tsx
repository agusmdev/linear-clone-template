import { AppMark } from '@/components/Navigation'

interface AuthFormShellProps {
  title: string
  description: string
  children: React.ReactNode
  footer: React.ReactNode
}

/** Linear-style auth page: a narrow centered column, no card. */
export function AuthFormShell({ title, description, children, footer }: AuthFormShellProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-[340px] flex-col items-center">
        <AppMark className="mb-6 size-10" />
        <h1 className="text-center text-[20px] font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-1.5 mb-8 text-center text-ui text-text-secondary">{description}</p>
        <div className="w-full">{children}</div>
        <div className="w-full">{footer}</div>
      </div>
    </div>
  )
}
