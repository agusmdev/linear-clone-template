/**
 * The workspace the user opened last, so "/" (sign-in, the logo, Home) goes
 * back to it, as Linear does, instead of the oldest workspace. The id, not the
 * URL key: it survives a rename. Per browser; a workspace the signed-in user
 * is not in is ignored by the caller.
 */
const LAST_WORKSPACE_KEY = 'last_workspace_id'

export function getLastWorkspaceId(): string | null {
  try {
    return localStorage.getItem(LAST_WORKSPACE_KEY)
  } catch {
    return null
  }
}

export function setLastWorkspaceId(id: string): void {
  try {
    localStorage.setItem(LAST_WORKSPACE_KEY, id)
  } catch {
    // Storage blocked (private mode): "/" opens the first workspace instead.
  }
}
