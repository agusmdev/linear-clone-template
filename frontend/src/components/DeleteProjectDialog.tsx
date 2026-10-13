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

interface DeleteProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectName: string
  isPending: boolean
  onConfirm: () => void
}

/** Confirm before a project is deleted. Its issues stay, without a project. */
export function DeleteProjectDialog({
  open,
  onOpenChange,
  projectName,
  isPending,
  onConfirm,
}: DeleteProjectDialogProps) {
  // A double click confirms twice before `isPending` disables the button.
  const confirmed = useRef(false)
  useEffect(() => {
    if (!isPending) confirmed.current = false
  }, [isPending, open])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete project?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{projectName}&rdquo; will be deleted. Its issues are kept and removed from the
            project. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={event => {
              event.preventDefault()
              if (confirmed.current) return
              confirmed.current = true
              onConfirm()
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Deleting…' : 'Delete project'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
