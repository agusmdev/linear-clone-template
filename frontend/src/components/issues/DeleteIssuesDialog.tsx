import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Issue } from '@/types/issue'

interface DeleteIssuesDialogProps {
  /** The issues to delete; the dialog is open while this is not empty. */
  issues: Issue[]
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** "Delete N issues?" confirmation (ISS-12 / ISS-14). */
export function DeleteIssuesDialog({
  issues,
  pending,
  onConfirm,
  onCancel,
}: DeleteIssuesDialogProps) {
  const one = issues.length === 1
  return (
    <AlertDialog open={issues.length > 0} onOpenChange={open => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {one ? 'Delete issue?' : `Delete ${issues.length} issues?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {one
              ? `${issues[0].identifier} "${issues[0].title}" will be deleted for everyone. Sub-issues stay, without a parent.`
              : 'These issues will be deleted for everyone. Sub-issues stay, without a parent.'}{' '}
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={event => {
              event.preventDefault()
              onConfirm()
            }}
          >
            {pending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
