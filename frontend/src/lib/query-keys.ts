import type { DocumentsParams } from '@/types/document'
import type { IssuesParams } from '@/types/issue'
import type { ItemsParams } from '@/types/item'
import type { SearchParams } from '@/types/search'
import type { ProjectsParams } from '@/types/project'
import type { NotificationsParams } from '@/types/notification'

export const queryKeys = {
  items: {
    all: ['items'] as const,
    list: (params?: ItemsParams) => ['items', 'list', params] as const,
  },
  me: {
    all: ['me'] as const,
  },
  workspaces: {
    all: ['workspaces'] as const,
    list: () => ['workspaces', 'list'] as const,
    byUrlKey: (urlKey: string) => ['workspaces', 'by-url-key', urlKey] as const,
    members: (workspaceId: string) => ['workspaces', workspaceId, 'members'] as const,
  },
  teams: {
    all: ['teams'] as const,
    list: (workspaceId: string) => ['teams', 'list', workspaceId] as const,
    states: (teamId: string) => ['teams', teamId, 'states'] as const,
  },
  labels: {
    all: ['labels'] as const,
    list: (workspaceId: string) => ['labels', 'list', workspaceId] as const,
  },
  issues: {
    all: ['issues'] as const,
    list: (params: IssuesParams) => ['issues', 'list', params] as const,
    detail: (id: string) => ['issues', 'detail', id] as const,
    byIdentifier: (workspaceId: string, identifier: string) =>
      ['issues', 'by-identifier', workspaceId, identifier] as const,
    /** Every page of a list, flattened (IssuesView). */
    listAll: (params: IssuesParams) => ['issues', 'list-all', params] as const,
  },
  search: {
    all: ['search'] as const,
    results: (workspaceId: string, params: SearchParams) =>
      ['search', workspaceId, params] as const,
  },
  favorites: {
    all: ['favorites'] as const,
    list: (workspaceId: string) => ['favorites', 'list', workspaceId] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: (workspaceId: string, params?: ProjectsParams) =>
      ['projects', 'list', workspaceId, params] as const,
    detail: (id: string) => ['projects', 'detail', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (params: NotificationsParams) => ['notifications', 'list', params] as const,
    unreadCount: (workspaceId: string) => ['notifications', 'unread-count', workspaceId] as const,
  },
  cycles: {
    all: ['cycles'] as const,
    list: (teamId: string) => ['cycles', 'list', teamId] as const,
    detail: (cycleId: string) => ['cycles', 'detail', cycleId] as const,
  },
  documents: {
    all: ['documents'] as const,
    lists: () => ['documents', 'list'] as const,
    list: (params: DocumentsParams) => ['documents', 'list', params] as const,
    detail: (id: string) => ['documents', 'detail', id] as const,
  },
}
