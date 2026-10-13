import { Check, CircleAlert, CircleDot, Loader2 } from 'lucide-react'
import type { AutosaveStatus } from '@/components/editor'

/** Combines several autosave states: any error wins, then any save in flight, then unsaved changes. */
export function combineSaveStatus(statuses: AutosaveStatus[]): AutosaveStatus {
  if (statuses.includes('error')) return 'error'
  if (statuses.includes('saving')) return 'saving'
  if (statuses.includes('unsaved')) return 'unsaved'
  if (statuses.includes('saved')) return 'saved'
  return 'idle'
}

/** "Unsaved" / "Saving…" / "Saved" / "Not saved" next to the document title. Nothing while idle. */
export function DocumentSaveStatus({ status }: { status: AutosaveStatus }) {
  if (status === 'idle') return null
  return (
    <span
      role="status"
      aria-live="polite"
      data-status={status}
      className="flex items-center gap-1 text-mini text-text-tertiary data-[status=error]:text-destructive"
    >
      {status === 'unsaved' ? (
        <>
          <CircleDot className="size-3" aria-hidden />
          Unsaved
        </>
      ) : status === 'saving' ? (
        <>
          <Loader2 className="size-3 animate-spin" aria-hidden />
          Saving…
        </>
      ) : status === 'saved' ? (
        <>
          <Check className="size-3" aria-hidden />
          Saved
        </>
      ) : (
        <>
          <CircleAlert className="size-3" aria-hidden />
          Not saved
        </>
      )}
    </span>
  )
}
