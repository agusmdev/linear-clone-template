export type FavoriteEntityType = 'issue' | 'project' | 'document' | 'team'

/** GET /workspaces/{id}/favorites, POST /favorites, PATCH /favorites/{id}. */
export interface Favorite {
  id: string
  user_id: string
  workspace_id: string
  entity_type: FavoriteEntityType
  entity_id: string
  sort_order: number
  /** Display name: issue "ENG-12 Title", project name, document title, team name. */
  name: string
  /** Issue identifier ("ENG-12") or team key ("ENG"); null for projects and documents. */
  identifier: string | null
  icon: string | null
  color: string | null
  created_at: string
}

export interface CreateFavoriteData {
  workspace_id: string
  entity_type: FavoriteEntityType
  entity_id: string
}

export interface UpdateFavoriteData {
  sort_order: number
}
