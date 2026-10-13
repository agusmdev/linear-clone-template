import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Box, Search } from 'lucide-react'
import { DocumentIcon } from '@/components/documents/DocumentIcon'
import { EmptyState } from '@/components/EmptyState'
import { FavoriteButton } from '@/components/FavoriteButton'
import { PageHeader } from '@/components/PageHeader'
import { StatusIcon } from '@/components/StatusIcon'
import { FOCUS_SEARCH_EVENT } from '@/components/WorkspaceCommands'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { useDebounce } from '@/hooks/useDebounce'
import { useSearch } from '@/hooks/useSearch'
import { cn } from '@/lib/utils'
import type { FavoriteEntityType } from '@/types/favorite'
import { SEARCH_QUERY_MAX_LENGTH, type SearchResults } from '@/types/search'

const TABS = ['all', 'issues', 'documents', 'projects'] as const
type SearchTab = (typeof TABS)[number]

interface SearchPageSearch {
  q?: string
  type?: SearchTab
}

const RESULT_LIMIT = 25
const DEBOUNCE_MS = 250

/** Global search page: issues, documents and projects of the workspace (UX-4). */
export const Route = createFileRoute('/_authed/$workspaceKey/search')({
  validateSearch: (search: Record<string, unknown>): SearchPageSearch => ({
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
    type:
      typeof search.type === 'string' && (TABS as readonly string[]).includes(search.type)
        ? (search.type as SearchTab)
        : undefined,
  }),
  component: SearchPage,
})

interface ResultRow {
  key: string
  to: string
  entityType: FavoriteEntityType
  entityId: string
  icon: ReactNode
  prefix?: string
  title: string
  meta?: string
}

interface ResultSection {
  tab: Exclude<SearchTab, 'all'>
  heading: string
  rows: ResultRow[]
}

function toSections(results: SearchResults, path: (p: string) => string): ResultSection[] {
  return [
    {
      tab: 'issues',
      heading: 'Issues',
      rows: results.issues.map(issue => ({
        key: `issue-${issue.id}`,
        to: path(`/issue/${issue.identifier}`),
        entityType: 'issue',
        entityId: issue.id,
        icon: (
          <StatusIcon type={issue.state.type} color={issue.state.color} label={issue.state.name} />
        ),
        prefix: issue.identifier,
        title: issue.title,
        meta: issue.team.name,
      })),
    },
    {
      tab: 'documents',
      heading: 'Documents',
      rows: results.documents.map(document => ({
        key: `document-${document.id}`,
        to: path(`/document/${document.id}`),
        entityType: 'document',
        entityId: document.id,
        icon: <DocumentIcon icon={document.icon} size={14} />,
        title: document.title,
        meta: 'Document',
      })),
    },
    {
      tab: 'projects',
      heading: 'Projects',
      rows: results.projects.map(project => ({
        key: `project-${project.id}`,
        to: path(`/project/${project.id}`),
        entityType: 'project',
        entityId: project.id,
        icon: (
          <Box
            className="size-3.5 text-text-secondary"
            style={project.color ? { color: project.color } : undefined}
          />
        ),
        title: project.name,
        meta: project.status.charAt(0).toUpperCase() + project.status.slice(1),
      })),
    },
  ]
}

/** Wraps case-insensitive matches of each word of `query` in <mark>. */
function Highlight({ text, query }: { text: string; query: string }) {
  const words = query.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return text
  const escaped = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  // Longest first, so "log" does not cut a "login" match short.
  escaped.sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  // split() with one capture group: the matches are at the odd indexes.
  return text.split(pattern).map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="rounded-[2px] bg-primary/25 text-foreground">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

function SearchPage() {
  const { workspace, path } = useCurrentWorkspace()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState((search.q ?? '').slice(0, SEARCH_QUERY_MAX_LENGTH))
  const [activeIndex, setActiveIndex] = useState(0)
  const query = useDebounce(text, DEBOUNCE_MS)
  const tab: SearchTab = search.type ?? 'all'
  const { data, isFetching, isError } = useSearch(workspace.id, { q: query, limit: RESULT_LIMIT })

  // Keep ?q= in step with the input (after the debounce), so the URL can be shared.
  useEffect(() => {
    const q = query.trim() || undefined
    if (q === search.q) return
    navigate({ search: prev => ({ ...prev, q }), replace: true })
  }, [query, search.q, navigate])

  useEffect(() => {
    const focus = () => inputRef.current?.focus()
    window.addEventListener(FOCUS_SEARCH_EVENT, focus)
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focus)
  }, [])

  const hasQuery = query.trim().length > 0
  const results = hasQuery ? data : undefined
  const sections = results ? toSections(results, path) : []
  const visible = sections.filter(section => tab === 'all' || section.tab === tab)
  const rows = visible.flatMap(section => section.rows)
  const count = (t: SearchTab) =>
    t === 'all'
      ? sections.reduce((n, s) => n + s.rows.length, 0)
      : (sections.find(s => s.tab === t)?.rows.length ?? 0)
  const selected = Math.min(activeIndex, Math.max(rows.length - 1, 0))

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(Math.min(selected + 1, rows.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(Math.max(selected - 1, 0))
    } else if (event.key === 'Enter' && rows[selected]) {
      event.preventDefault()
      navigate({ to: rows[selected].to as '/' })
    } else if (event.key === 'Escape') {
      inputRef.current?.blur()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Search" icon={<Search className="size-4 text-text-secondary" />}>
        <Tabs
          value={tab}
          onValueChange={value => {
            setActiveIndex(0)
            navigate({
              search: prev => ({
                ...prev,
                type: value === 'all' ? undefined : (value as SearchTab),
              }),
              replace: true,
            })
          }}
        >
          <TabsList aria-label="Result type">
            {TABS.map(t => (
              <TabsTrigger key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {results ? <span className="text-text-tertiary">{count(t)}</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </PageHeader>
      <div className="flex items-center gap-3 border-b border-border-subtle px-4">
        <Search className="size-4 shrink-0 text-text-tertiary" aria-hidden />
        <input
          ref={inputRef}
          // The page is opened to type: "/" and the sidebar search button land here.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          type="search"
          maxLength={SEARCH_QUERY_MAX_LENGTH}
          aria-label="Search workspace"
          placeholder="Search issues, projects and documents…"
          value={text}
          onChange={event => {
            setText(event.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={onKeyDown}
          className="h-12 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-text-tertiary [&::-webkit-search-cancel-button]:hidden"
        />
        {isFetching ? <span className="text-mini text-text-tertiary">Searching…</span> : null}
      </div>
      <div className="flex-1 overflow-y-auto" role="region" aria-label="Search results">
        {!hasQuery ? (
          <EmptyState
            icon={<Search />}
            title="Search your workspace"
            description="Find issues, projects and documents by title, content or ID, like ENG-12."
          />
        ) : isError ? (
          <EmptyState title="Search failed" description="Could not load results. Try again." />
        ) : !results ? (
          <div aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="flex h-10 items-center gap-3 border-b border-border-subtle px-4"
              >
                <Skeleton className="size-3.5 rounded-full" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Search />}
            title="No results"
            description={`Nothing matches “${query.trim()}”${tab === 'all' ? '' : ` in ${tab}`}.`}
          />
        ) : (
          visible
            .filter(section => section.rows.length > 0)
            .map(section => (
              <section key={section.tab} aria-label={section.heading}>
                {tab === 'all' ? (
                  <h2 className="flex h-9 items-center gap-2 bg-surface-hover/50 px-4 text-ui font-medium">
                    {section.heading}
                    <span className="text-text-tertiary">{section.rows.length}</span>
                  </h2>
                ) : null}
                <ul>
                  {section.rows.map(row => {
                    const index = rows.indexOf(row)
                    return (
                      <li
                        key={row.key}
                        data-testid="search-result"
                        className={cn(
                          'group flex h-10 items-center gap-2 border-b border-border-subtle pr-3 hover:bg-surface-hover',
                          index === selected && 'bg-surface-active hover:bg-surface-active'
                        )}
                        onMouseEnter={() => setActiveIndex(index)}
                      >
                        <Link
                          to={row.to as '/'}
                          className="flex h-full min-w-0 flex-1 items-center gap-3 pl-4 text-ui outline-none"
                        >
                          <span className="flex size-4 shrink-0 items-center justify-center">
                            {row.icon}
                          </span>
                          {row.prefix ? (
                            <span className="min-w-16 shrink-0 whitespace-nowrap text-text-tertiary">
                              {row.prefix}
                            </span>
                          ) : null}
                          <span className="min-w-0 flex-1 truncate">
                            <Highlight text={row.title} query={query} />
                          </span>
                          {row.meta ? (
                            <span className="shrink-0 text-mini text-text-tertiary">
                              {row.meta}
                            </span>
                          ) : null}
                        </Link>
                        <FavoriteButton
                          entityType={row.entityType}
                          entityId={row.entityId}
                          size="sm"
                        />
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))
        )}
      </div>
    </div>
  )
}
