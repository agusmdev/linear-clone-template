import { type NavigateOptions } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { toastApiError } from '@/lib/error-handler'
import type { AuthSessionResponse } from '@/types/auth'

/**
 * Core auth submit logic — a framework-agnostic orchestrator used by the
 * useAuthSubmit hook.
 *
 * Handles the api.post → login → toast → navigate sequence. On failure,
 * `handleError` may show the error itself (e.g. under a form field) and return
 * true; otherwise the error is surfaced via toastApiError. Either way it is
 * re-thrown so callers (e.g. useAuthSubmit / useMutation) can observe rejection.
 * Lives in features/auth/ (not hooks/) because it is a plain async function
 * that uses no React APIs.
 */
export async function executeAuthSubmit(
  endpoint: string,
  payload: Record<string, unknown>,
  deps: {
    login: (token: string) => void
    navigate: (opts: NavigateOptions) => void
    successMessage: string
    errorMessage: string
    redirect: NavigateOptions
    handleError?: (error: unknown) => boolean
  }
): Promise<void> {
  try {
    const result = await api.post<AuthSessionResponse>(endpoint, payload)
    deps.login(result.id)
    toast.success(deps.successMessage)
    deps.navigate(deps.redirect)
  } catch (err) {
    if (!deps.handleError?.(err)) toastApiError(err, deps.errorMessage)
    throw err
  }
}
