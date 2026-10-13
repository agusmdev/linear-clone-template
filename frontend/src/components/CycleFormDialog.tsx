import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { cycleSchema, type CycleFormData } from '@/features/cycles/cycle-schemas'
import { daysBetween } from '@/features/cycles/cycle-dates'
import { toastApiError } from '@/lib/error-handler'

interface CycleFormDialogProps {
  mode: 'create' | 'edit'
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Values when the dialog opens (the next two weeks for a new cycle). */
  defaultValues: CycleFormData
  /** "Cycle 4": the name a cycle without a custom name gets. */
  numberLabel?: string
  isPending: boolean
  onSubmit: (data: CycleFormData) => Promise<void>
}

/** Create or edit a cycle: optional name, start date, end date. */
export function CycleFormDialog({
  mode,
  open,
  onOpenChange,
  defaultValues,
  numberLabel,
  isPending,
  onSubmit,
}: CycleFormDialogProps) {
  const form = useForm<CycleFormData>({
    resolver: zodResolver(cycleSchema),
    defaultValues,
  })
  const { reset } = form

  // Fresh values every time the dialog opens.
  useEffect(() => {
    if (open) reset(defaultValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [open, reset])

  const startsAt = form.watch('starts_at')
  const endsAt = form.watch('ends_at')
  const length =
    /^\d{4}-\d{2}-\d{2}$/.test(startsAt) && /^\d{4}-\d{2}-\d{2}$/.test(endsAt)
      ? daysBetween(startsAt, endsAt) + 1
      : null

  const handleSubmit = async (data: CycleFormData) => {
    try {
      await onSubmit(data)
      onOpenChange(false)
    } catch (error) {
      toastApiError(error, mode === 'create' ? 'Could not create cycle' : 'Could not update cycle')
    }
  }

  const title = mode === 'create' ? 'New cycle' : 'Edit cycle'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Plan a focused period of work for the team.'
              : 'Change the name or the dates of this cycle.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            method="post"
            action="#"
            noValidate
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={numberLabel ?? 'Cycle name'}
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="starts_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ends_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {length !== null && length > 0 ? (
              <p className="text-mini text-text-tertiary" data-testid="cycle-length">
                {length} {length === 1 ? 'day' : 'days'}
                {length % 7 === 0 ? ` · ${length / 7} ${length === 7 ? 'week' : 'weeks'}` : ''}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {mode === 'create'
                  ? isPending
                    ? 'Creating…'
                    : 'Create cycle'
                  : isPending
                    ? 'Saving…'
                    : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
