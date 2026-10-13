import type { IssueRef } from '@/types/issue'
import type { ProjectStatus } from '@/types/project'

/** Planned: GET /workspaces/{id}/search (see docs/API.md). */
export interface SearchResults {
  issues: IssueRef[]
  documents: { id: string; title: string; icon: string | null; project_id: string | null }[]
  projects: { id: string; name: string; icon: string | null; status: ProjectStatus }[]
}
