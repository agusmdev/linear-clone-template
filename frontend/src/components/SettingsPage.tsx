import * as React from 'react'
import { cn } from '@/lib/utils'

interface SettingsPageProps {
  /** Big page title (an h2: the PageHeader above holds the h1). */
  title: string
  description?: React.ReactNode
  /** Right of the title, e.g. a "New label" button. */
  actions?: React.ReactNode
  children: React.ReactNode
}

/** The centered column of a settings page (Linear: ~640px, big title, muted description). */
export function SettingsPage({ title, description, actions, children }: SettingsPageProps) {
  return (
    <div className="mx-auto w-full max-w-[680px] px-6 py-10 sm:py-14">
      <div className="mb-8 flex items-end justify-between gap-4">
        {/* A long unbroken name (team, workspace) wraps instead of overflowing. */}
        <div className="min-w-0 [overflow-wrap:anywhere]">
          <h2 className="text-[24px] leading-tight font-semibold tracking-[-0.01em] text-foreground">
            {title}
          </h2>
          {description ? <p className="mt-1.5 text-ui text-text-secondary">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="flex flex-col gap-10">{children}</div>
    </div>
  )
}

interface SettingsSectionProps {
  title?: string
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/** A titled group of rows inside a settings page. */
export function SettingsSection({
  title,
  description,
  actions,
  children,
  className,
}: SettingsSectionProps) {
  const id = React.useId()
  return (
    <section aria-labelledby={title ? id : undefined} className={cn('flex flex-col', className)}>
      {title || actions ? (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h3 id={id} className="text-ui font-medium text-foreground">
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-mini text-text-secondary">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

/** Bordered box that holds settings rows (rows are split by subtle dividers). */
export function SettingsCard({ children, className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-surface [&>*+*]:border-t [&>*+*]:border-border-subtle',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface SettingsRowProps {
  label: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

/** One "label + control" row of a SettingsCard. */
export function SettingsRow({ label, description, children, className }: SettingsRowProps) {
  return (
    <div className={cn('flex min-h-14 items-center justify-between gap-4 px-4 py-3', className)}>
      <div className="min-w-0">
        <div className="text-ui text-foreground">{label}</div>
        {description ? (
          <div className="mt-0.5 text-mini text-text-secondary">{description}</div>
        ) : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  )
}
