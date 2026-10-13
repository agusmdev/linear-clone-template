import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { StatusIcon, type StatusType } from '@/components/StatusIcon'
import { PriorityIcon, type Priority } from '@/components/PriorityIcon'
import { UserAvatar } from '@/components/UserAvatar'
import { Kbd } from '@/components/Kbd'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
  component: HomePage,
})

interface PreviewIssue {
  id: string
  title: string
  status: StatusType
  progress?: number
  priority: Priority
  assignee: string | null
  label?: { name: string; color: string }
}

const previewIssues: PreviewIssue[] = [
  {
    id: 'ENG-128',
    title: 'Keyboard-first command palette',
    status: 'started',
    priority: 1,
    assignee: 'Ada Lovelace',
    label: { name: 'Feature', color: '#b17fea' },
  },
  {
    id: 'ENG-127',
    title: 'Drag issues between board columns',
    status: 'started',
    progress: 0.75,
    priority: 2,
    assignee: 'Grace Hopper',
  },
  {
    id: 'ENG-121',
    title: 'Autosave documents while typing',
    status: 'unstarted',
    priority: 3,
    assignee: 'Alan Turing',
    label: { name: 'Docs', color: '#26b5ce' },
  },
  {
    id: 'ENG-117',
    title: 'Fix flicker when switching themes',
    status: 'completed',
    priority: 2,
    assignee: 'Ada Lovelace',
    label: { name: 'Bug', color: '#eb5757' },
  },
  {
    id: 'ENG-109',
    title: 'Cycle burn-up chart',
    status: 'backlog',
    priority: 4,
    assignee: null,
  },
]

const features = [
  { title: 'Issues', text: 'Fast lists and boards with statuses, priorities and labels.' },
  { title: 'Documents', text: 'Write specs next to the work, with a rich-text editor.' },
  { title: 'Projects & cycles', text: 'Plan the roadmap and run focused weekly cycles.' },
]

function HomePage() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_65%)]"
      />
      <section className="relative mx-auto flex w-full max-w-4xl flex-col items-center px-4 pt-20 pb-12 text-center sm:pt-28">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-mini text-text-secondary">
          <span className="size-1.5 rounded-full bg-primary" />
          Issues, projects and docs in one place
        </span>
        <h1 className="max-w-3xl text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-[56px]">
          Plan and build products, together.
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-text-secondary">
          A fast, keyboard-first tool for issue tracking, project planning and team docs.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link to="/register" className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}>
            Get Started
            <ArrowRight />
          </Link>
          <Link to="/login" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
            Sign In
          </Link>
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-mini text-text-tertiary">
          Press <Kbd>C</Kbd> to create an issue, <Kbd>⌘</Kbd>
          <Kbd>K</Kbd> for everything else
        </p>
      </section>

      <section aria-label="Product preview" className="relative mx-auto w-full max-w-4xl px-4">
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-popover">
          <div className="flex h-10 items-center gap-2 border-b border-border-subtle px-4 text-ui">
            <span className="font-medium text-foreground">Engineering</span>
            <span className="text-text-tertiary">/</span>
            <span className="text-text-secondary">Active issues</span>
          </div>
          <ul>
            {previewIssues.map(issue => (
              <li
                key={issue.id}
                className="flex h-10 items-center gap-3 border-b border-border-subtle px-4 text-ui last:border-b-0"
              >
                <PriorityIcon priority={issue.priority} />
                <span className="w-16 shrink-0 text-text-tertiary">{issue.id}</span>
                <StatusIcon type={issue.status} progress={issue.progress} />
                <span className="min-w-0 flex-1 truncate text-left text-foreground">
                  {issue.title}
                </span>
                {issue.label ? (
                  <span className="hidden items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-mini text-text-secondary sm:inline-flex">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: issue.label.color }}
                    />
                    {issue.label.name}
                  </span>
                ) : null}
                <UserAvatar name={issue.assignee} size="sm" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative mx-auto grid w-full max-w-4xl gap-px px-4 py-16 sm:grid-cols-3">
        {features.map(feature => (
          <div key={feature.title} className="p-4">
            <h2 className="text-ui font-medium text-foreground">{feature.title}</h2>
            <p className="mt-1 text-ui text-text-secondary">{feature.text}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
