import type { ReactNode } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Archive, Box, CircleDot, FileText, Layers, PlayCircle, Target } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'

/** Views page: the built-in views of the workspace as cards (ISS-13). */
export const Route = createFileRoute('/_authed/$workspaceKey/views')({
  component: ViewsPage,
})

interface ViewCard {
  name: string
  description: string
  to: string
  /** Query string of the target page (e.g. the team issues tab). */
  search?: Record<string, string>
  icon: ReactNode
}

function ViewCardLink({ view }: { view: ViewCard }) {
  return (
    <li>
      <Link
        to={view.to as '/'}
        // Dynamic workspace routes are typed as '/': pass the target's query as-is.
        search={view.search as never}
        className="group flex h-full items-start gap-3 rounded-lg border border-border-subtle bg-surface p-4 transition-colors hover:border-border hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-active text-text-secondary group-hover:text-foreground [&_svg]:size-4">
          {view.icon}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-ui font-medium text-foreground">{view.name}</span>
          <span className="text-mini text-text-tertiary">{view.description}</span>
        </span>
      </Link>
    </li>
  )
}

function ViewSection({
  title,
  icon,
  views,
}: {
  title: string
  icon?: ReactNode
  views: ViewCard[]
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-mini font-medium text-text-secondary">
        {icon}
        {title}
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {views.map(view => (
          <ViewCardLink key={view.name} view={view} />
        ))}
      </ul>
    </section>
  )
}

function ViewsPage() {
  const { teams, path } = useCurrentWorkspace()

  const workspaceViews: ViewCard[] = [
    {
      name: 'My issues',
      description: 'Issues assigned to you, created by you or that you subscribe to',
      to: path('/my-issues'),
      icon: <Target />,
    },
    {
      name: 'Projects',
      description: 'Every project of the workspace with its progress',
      to: path('/projects'),
      icon: <Box />,
    },
    {
      name: 'Documents',
      description: 'Specs, notes and docs of the workspace',
      to: path('/documents'),
      icon: <FileText />,
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Views" icon={<Layers className="size-4 text-text-secondary" />} />
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-6 py-6">
        <ViewSection title="Workspace" views={workspaceViews} />
        {teams.map(team => (
          <ViewSection
            key={team.id}
            title={team.name}
            icon={
              <span
                aria-hidden
                className="inline-flex size-4 items-center justify-center rounded-[3px] text-[8px] font-bold text-white"
                style={{ backgroundColor: team.color ?? 'var(--primary)' }}
              >
                {team.key.slice(0, 2)}
              </span>
            }
            views={[
              {
                name: `${team.name} · All issues`,
                description: 'Every issue of the team that is not archived',
                to: path(`/team/${team.key}/issues`),
                icon: <CircleDot />,
              },
              {
                name: `${team.name} · Active`,
                description: 'Issues in Todo and In Progress',
                to: path(`/team/${team.key}/issues`),
                search: { view: 'active' },
                icon: <PlayCircle />,
              },
              {
                name: `${team.name} · Backlog`,
                description: 'Issues waiting in the backlog',
                to: path(`/team/${team.key}/issues`),
                search: { view: 'backlog' },
                icon: <Archive />,
              },
            ]}
          />
        ))}
      </div>
    </div>
  )
}
