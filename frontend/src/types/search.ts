import type { IssueRef } from '@/types/issue'
import type { ProjectStatus } from '@/types/project'
import type { TeamSummary } from '@/types/team'

export type SearchType = 'issue' | 'document' | 'project'

/** An issue in search results: IssueRef plus its team. */
export interface IssueSearchResult extends IssueRef {
  team: TeamSummary
}

export interface DocumentSearchResult {
  id: string
  title: string
  icon: string | null
  project_id: string | null
}

export interface ProjectSearchResult {
  id: string
  name: string
  icon: string | null
  color: string | null
  status: ProjectStatus
}

/** GET /workspaces/{id}/search. */
export interface SearchResults {
  issues: IssueSearchResult[]
  documents: DocumentSearchResult[]
  projects: ProjectSearchResult[]
}

export interface SearchParams {
  q: string
  types?: SearchType[]
  /** Per type, 1..50 (default 10). */
  limit?: number
}
