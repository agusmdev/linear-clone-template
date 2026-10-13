import { useEffect, useRef } from 'react'
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

interface DeleteDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  pending: boolean
  onConfirm: () => void
}

/** Confirm before a document is deleted (it cannot be restored). */
export function DeleteDocumentDialog({
  open,
  onOpenChange,
  title,
  pending,
  onConfirm,
}: DeleteDocumentDialogProps) {
  // A double click confirms twice before `pending` disables the button.
  const confirmed = useRef(false)
  useEffect(() => {
    if (!pending) confirmed.current = false
  }, [pending, open])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete document</AlertDialogTitle>
          <AlertDialogDescription>
            Delete &quot;{title}&quot;? This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={event => {
              event.preventDefault()
              if (confirmed.current) return
              confirmed.current = true
              onConfirm()
            }}
          >
            {pending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
