/** localStorage key of the session token. The e2e fixtures use it to sign users in. */
export const AUTH_TOKEN_KEY = 'auth_token'

// Subscribers are notified whenever the auth token changes — allows api-client
// to trigger AuthContext re-renders when it clears the token on 401. A change
// made in another tab (sign-out, or sign-in as someone else) counts too:
// localStorage is shared, so this tab now sends the other tab's token.
type AuthChangeListener = () => void
const authChangeListeners = new Set<AuthChangeListener>()

/** True for a `storage` event that changed the token (`key` is null for localStorage.clear()). */
export function isAuthStorageEvent(event: StorageEvent): boolean {
  return event.key === AUTH_TOKEN_KEY || event.key === null
}

function onStorage(event: StorageEvent) {
  if (isAuthStorageEvent(event)) notifyAuthChange()
}

export function subscribeToAuthChanges(listener: AuthChangeListener): () => void {
  authChangeListeners.add(listener)
  if (authChangeListeners.size === 1) window.addEventListener('storage', onStorage)
  return () => {
    authChangeListeners.delete(listener)
    if (authChangeListeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

function notifyAuthChange() {
  authChangeListeners.forEach(listener => listener())
}

export function getAuthToken(): string | null {
  if (typeof localStorage === 'undefined') {
    return null
  }
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token: string): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.setItem(AUTH_TOKEN_KEY, token)
  notifyAuthChange()
}

export function clearAuthToken(): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.removeItem(AUTH_TOKEN_KEY)
  notifyAuthChange()
}
