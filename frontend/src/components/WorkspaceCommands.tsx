import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Box,
  CircleDot,
  FileText,
  FilePlus,
  FolderPlus,
  Inbox,
  Keyboard,
  Layers,
  LogOut,
  Moon,
  RefreshCcw,
  Search,
  Settings,
  SquarePen,
  Star,
  Sun,
  Target,
} from 'lucide-react'
import {
  CommandPalette,
  ShortcutsHelpDialog,
  useShortcut,
  type CommandGroupData,
  type CommandItemData,
  type ShortcutHelpGroup,
} from '@/components/command'
import { CreateProjectDialog } from '@/components/CreateProjectDialog'
import { StatusIcon } from '@/components/StatusIcon'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { useNewDocument } from '@/features/documents/useNewDocument'
import { useDebounce } from '@/hooks/useDebounce'
import { favoritePath, useFavorites } from '@/hooks/useFavorites'
import { useSearch } from '@/hooks/useSearch'
import { openCreateIssue } from '@/lib/issue-events'

/** Window event that opens the command palette (any slice can dispatch it). */
export const COMMAND_PALETTE_EVENT = 'linear:command-palette'
/** Window event the search page listens to: focus its input. */
export const FOCUS_SEARCH_EVENT = 'linear:focus-search'

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT))
}

/** Every global shortcut, for the "?" help dialog. */
export const SHORTCUT_HELP: ShortcutHelpGroup[] = [
  {
    heading: 'General',
    shortcuts: [
      { keys: 'mod+k', description: 'Open command menu' },
      { keys: 'c', description: 'Create new issue' },
      { keys: '/', description: 'Search' },
      { keys: '?', description: 'Show keyboard shortcuts' },
      { keys: 'esc', description: 'Close / go back' },
    ],
  },
  {
    heading: 'Navigation',
    shortcuts: [
      { keys: 'g i', description: 'Go to inbox' },
      { keys: 'g m', description: 'Go to my issues' },
      { keys: 'g p', description: 'Go to projects' },
      { keys: 'g d', description: 'Go to documents' },
      { keys: 'g s', description: 'Go to settings' },
    ],
  },
  {
    heading: 'Issue list',
    shortcuts: [
      { keys: 'j', description: 'Move down' },
      { keys: 'k', description: 'Move up' },
      { keys: 'enter', description: 'Open highlighted issue' },
      { keys: 's', description: 'Change status' },
      { keys: 'p', description: 'Change priority' },
      { keys: 'a', description: 'Assign to…' },
      { keys: 'l', description: 'Change labels' },
      { keys: 'x', description: 'Select issue' },
      { keys: 'mod+backspace', description: 'Delete selected issues' },
    ],
  },
  {
    heading: 'Issue page',
    shortcuts: [
      { keys: 's', description: 'Change status' },
      { keys: 'p', description: 'Change priority' },
      { keys: 'a', description: 'Assign to…' },
      { keys: 'l', description: 'Change labels' },
      { keys: 'i', description: 'Assign to me' },
      { keys: 'r', description: 'Rename issue' },
      { keys: 'shift+s', description: 'Subscribe / unsubscribe' },
      { keys: 'mod+.', description: 'Copy issue ID' },
      { keys: 'mod+backspace', description: 'Delete issue' },
    ],
  },
  {
    heading: 'Inbox',
    shortcuts: [
      { keys: 'j', description: 'Next notification' },
      { keys: 'k', description: 'Previous notification' },
      { keys: 'u', description: 'Mark read / unread' },
      { keys: 'e', description: 'Archive' },
      { keys: 'enter', description: 'Open issue' },
    ],
  },
]

const SEARCH_DEBOUNCE_MS = 200

/**
 * Global command layer of a workspace: the Cmd/Ctrl+K command palette (with
 * async search), the global keyboard shortcuts and the "?" shortcuts help.
 * Render it once inside WorkspaceContext and a <ShortcutsProvider>.
 */
export function WorkspaceCommands() {
  const { workspace, teams, members, path } = useCurrentWorkspace()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const favoritesQuery = useFavorites(workspace.id)
  const newDocument = useNewDocument()

  const [open, setOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS)
  const searchQuery = useSearch(workspace.id, { q: open ? debouncedQuery : '', limit: 5 })

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpen)
    return () => window.removeEventListener(COMMAND_PALETTE_EVENT, onOpen)
  }, [])

  const go = (subPath: string) => navigate({ to: path(subPath) as '/' })
  const goSearch = () => {
    go('/search')
    // Already on the search page: the input is mounted, focus it.
    window.dispatchEvent(new CustomEvent(FOCUS_SEARCH_EVENT))
  }
  const signOut = async () => {
    await logout()
    navigate({ to: '/login' })
  }

  useShortcut('mod+k', () => setOpen(o => !o), { allowInInputs: true })
  useShortcut('c', () => openCreateIssue())
  useShortcut('/', goSearch)
  useShortcut('?', () => setHelpOpen(true))
  useShortcut('g i', () => go('/inbox'))
  useShortcut('g m', () => go('/my-issues'))
  useShortcut('g p', () => go('/projects'))
  useShortcut('g d', () => go('/documents'))
  useShortcut('g s', () => go('/settings'))

  const groups = useMemo<CommandGroupData[]>(() => {
    const favorites = favoritesQuery.data ?? []
    const base = path('')
    const result: CommandGroupData[] = [
      {
        heading: 'Create',
        items: [
          {
            id: 'create-issue',
            label: 'Create new issue',
            icon: <SquarePen />,
            shortcut: 'c',
            keywords: ['new issue', 'add'],
            onSelect: () => openCreateIssue(),
          },
          {
            id: 'create-document',
            label: 'Create new document',
            icon: <FilePlus />,
            keywords: ['new document', 'doc'],
            onSelect: () => void newDocument.createAndOpen(),
          },
          {
            id: 'create-project',
            label: 'Create new project',
            icon: <FolderPlus />,
            keywords: ['new project'],
            onSelect: () => setCreateProjectOpen(true),
          },
        ],
      },
      {
        heading: 'Navigation',
        items: [
          {
            id: 'go-inbox',
            label: 'Go to inbox',
            icon: <Inbox />,
            shortcut: 'g i',
            keywords: ['notifications'],
            onSelect: () => go('/inbox'),
          },
          {
            id: 'go-my-issues',
            label: 'Go to my issues',
            icon: <Target />,
            shortcut: 'g m',
            keywords: ['assigned'],
            onSelect: () => go('/my-issues'),
          },
          {
            id: 'go-projects',
            label: 'Go to projects',
            icon: <Box />,
            shortcut: 'g p',
            onSelect: () => go('/projects'),
          },
          {
            id: 'go-documents',
            label: 'Go to documents',
            icon: <FileText />,
            shortcut: 'g d',
            keywords: ['docs'],
            onSelect: () => go('/documents'),
          },
          {
            id: 'go-views',
            label: 'Go to views',
            icon: <Layers />,
            onSelect: () => go('/views'),
          },
          {
            id: 'go-search',
            label: 'Search workspace',
            icon: <Search />,
            shortcut: '/',
            keywords: ['find'],
            onSelect: goSearch,
          },
          ...teams.flatMap<CommandItemData>(team => [
            {
              id: `go-team-issues-${team.id}`,
              label: `Go to ${team.name} issues`,
              icon: <CircleDot />,
              keywords: [team.key, 'team'],
              onSelect: () => go(`/team/${team.key}/issues`),
            },
            {
              id: `go-team-cycles-${team.id}`,
              label: `Go to ${team.name} cycles`,
              icon: <RefreshCcw />,
              keywords: [team.key, 'team', 'sprint'],
              onSelect: () => go(`/team/${team.key}/cycles`),
            },
            {
              id: `go-team-projects-${team.id}`,
              label: `Go to ${team.name} projects`,
              icon: <Box />,
              keywords: [team.key, 'team'],
              onSelect: () => go(`/team/${team.key}/projects`),
            },
          ]),
          {
            id: 'go-settings',
            label: 'Go to settings',
            icon: <Settings />,
            shortcut: 'g s',
            keywords: ['preferences', 'workspace'],
            onSelect: () => go('/settings'),
          },
        ],
      },
    ]
    if (favorites.length > 0) {
      result.push({
        heading: 'Favorites',
        items: favorites.map(favorite => ({
          id: `favorite-${favorite.id}`,
          label: `Open ${favorite.name}`,
          icon: <Star />,
          keywords: ['favorite', favorite.name],
          onSelect: () => navigate({ to: favoritePath(base, favorite) as '/' }),
        })),
      })
    }
    result.push({
      heading: 'General',
      items: [
        {
          id: 'toggle-theme',
          label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
          icon: theme === 'dark' ? <Sun /> : <Moon />,
          keywords: ['theme', 'dark', 'light', 'appearance'],
          onSelect: toggleTheme,
        },
        {
          id: 'show-shortcuts',
          label: 'Show keyboard shortcuts',
          icon: <Keyboard />,
          shortcut: '?',
          keywords: ['help', 'keys'],
          onSelect: () => setHelpOpen(true),
        },
        {
          id: 'log-out',
          label: 'Log out',
          icon: <LogOut />,
          keywords: ['sign out'],
          onSelect: () => void signOut(),
        },
      ],
    })
    return result
    // go/goSearch/signOut only close over navigate, path and logout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoritesQuery.data, teams, theme, toggleTheme, path, navigate, newDocument])

  const results = query.trim() ? searchQuery.data : undefined
  const searchGroups = useMemo<CommandGroupData[]>(() => {
    if (!results) return []
    const groups: CommandGroupData[] = []
    if (results.issues.length > 0) {
      groups.push({
        heading: 'Issues',
        items: results.issues.map(issue => ({
          id: `search-issue-${issue.id}`,
          label: `${issue.identifier} ${issue.title}`,
          icon: <StatusIcon type={issue.state.type} color={issue.state.color} />,
          onSelect: () => navigate({ to: path(`/issue/${issue.identifier}`) as '/' }),
        })),
      })
    }
    if (results.projects.length > 0) {
      groups.push({
        heading: 'Projects',
        items: results.projects.map(project => ({
          id: `search-project-${project.id}`,
          label: project.name,
          icon: <Box style={project.color ? { color: project.color } : undefined} />,
          onSelect: () => navigate({ to: path(`/project/${project.id}`) as '/' }),
        })),
      })
    }
    if (results.documents.length > 0) {
      groups.push({
        heading: 'Documents',
        items: results.documents.map(document => ({
          id: `search-document-${document.id}`,
          label: document.title,
          icon: <FileText />,
          onSelect: () => navigate({ to: path(`/document/${document.id}`) as '/' }),
        })),
      })
    }
    return groups
  }, [results, navigate, path])

  return (
    <>
      <CommandPalette
        open={open}
        onOpenChange={next => {
          setOpen(next)
          if (!next) setQuery('')
        }}
        groups={groups}
        onSearchChange={setQuery}
        searchGroups={searchGroups}
        loading={!!query.trim() && (searchQuery.isFetching || query !== debouncedQuery)}
      />
      <ShortcutsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} groups={SHORTCUT_HELP} />
      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        workspaceId={workspace.id}
        teams={teams}
        members={members}
        onCreated={project => navigate({ to: path(`/project/${project.id}`) as '/' })}
      />
    </>
  )
}
