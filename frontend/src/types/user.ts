/** GET /users/me. The display name is `display_name` here. */
export interface User {
  id: string
  email: string
  display_name: string
  email_verified_at: string | null
  is_email_verified: boolean
}

/** A user embedded in other responses (assignee, creator, member, author). `name` = display name. */
export interface UserSummary {
  id: string
  name: string
  email: string
}

export interface UpdateUserData {
  display_name?: string
}
