import type { IssuesParams } from '@/types/issue'
import type { ItemsParams } from '@/types/item'

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
  },
  cycles: {
    all: ['cycles'] as const,
    list: (teamId: string) => ['cycles', 'list', teamId] as const,
    detail: (cycleId: string) => ['cycles', 'detail', cycleId] as const,
  },
}
