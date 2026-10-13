import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface DeleteIssueDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** e.g. "ENG-12". */
  identifier: string
  onConfirm: () => void
  pending?: boolean
}

/** "Delete issue ENG-12?" confirm. Sub-issues stay, without a parent. */
export function DeleteIssueDialog({
  open,
  onOpenChange,
  identifier,
  onConfirm,
  pending,
}: DeleteIssueDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete issue {identifier}?</AlertDialogTitle>
          <AlertDialogDescription>
            This can&apos;t be undone. Comments and history are deleted too; sub-issues are kept
            without a parent.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
