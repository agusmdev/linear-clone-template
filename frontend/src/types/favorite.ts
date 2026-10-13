export type FavoriteEntityType = 'issue' | 'project' | 'document' | 'team'

/** Planned: /favorites endpoints (see docs/API.md). */
export interface Favorite {
  id: string
  user_id: string
  workspace_id: string
  entity_type: FavoriteEntityType
  entity_id: string
  sort_order: number
  /** Display name: issue "ENG-12 Title", project name, document title, team name. */
  name: string
  created_at: string
}

export interface CreateFavoriteData {
  workspace_id: string
  entity_type: FavoriteEntityType
  entity_id: string
}
