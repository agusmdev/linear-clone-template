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

interface DeleteCycleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "Cycle 3" or the custom name. */
  title: string
  isPending: boolean
  onConfirm: () => void
}

/** Confirm the delete of a cycle. Its issues stay, without a cycle. */
export function DeleteCycleDialog({
  open,
  onOpenChange,
  title,
  isPending,
  onConfirm,
}: DeleteCycleDialogProps) {
  // A double click confirms twice before `isPending` disables the button.
  const confirmed = useRef(false)
  useEffect(() => {
    if (!isPending) confirmed.current = false
  }, [isPending, open])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its issues are kept and removed from the cycle. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={event => {
              event.preventDefault()
              if (confirmed.current) return
              confirmed.current = true
              onConfirm()
            }}
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
