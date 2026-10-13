import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ColorPicker } from '@/components/ColorPicker'
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
import { ApiError } from '@/lib/api-client'
import { toastApiError } from '@/lib/error-handler'
import {
  COLOR_PALETTE,
  deriveTeamKey,
  teamSchema,
  type TeamFormData,
} from '@/features/workspaces/workspace-schemas'

interface CreateTeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Creates the team; rejects with the API error. */
  onSubmit: (data: TeamFormData) => Promise<void>
  pending?: boolean
}

const emptyTeam: TeamFormData = { name: '', key: '', description: '', color: COLOR_PALETTE[1] }

/** "Create a team": name, key (follows the name until edited), color. */
export function CreateTeamDialog({ open, onOpenChange, onSubmit, pending }: CreateTeamDialogProps) {
  const [keyEdited, setKeyEdited] = useState(false)
  const form = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    defaultValues: emptyTeam,
  })

  const handleOpenChange = (next: boolean) => {
    if (next) {
      form.reset(emptyTeam)
      setKeyEdited(false)
    }
    onOpenChange(next)
  }

  const submit = async (data: TeamFormData) => {
    try {
      await onSubmit(data)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'duplicate_item') {
        form.setError('key', { message: 'Another team already uses this key' })
        return
      }
      toastApiError(error, 'Could not create the team')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[440px]"
        onOpenAutoFocus={event => {
          // Start in the name field, not on the color swatch.
          event.preventDefault()
          form.setFocus('name')
        }}
      >
        <DialogHeader>
          <DialogTitle>Create a team</DialogTitle>
          <DialogDescription>
            Teams have their own issues, workflow and cycles. The key prefixes issue IDs (ENG-12).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            method="post"
            action="#"
            noValidate
            onSubmit={form.handleSubmit(submit)}
            className="space-y-4"
          >
            <div className="flex items-start gap-3">
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem className="pt-[22px]">
                    <ColorPicker label="Team color" value={field.value} onChange={field.onChange} />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Team name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. Design"
                        onChange={event => {
                          field.onChange(event)
                          if (!keyEdited) {
                            form.setValue('key', deriveTeamKey(event.target.value), {
                              shouldValidate: form.formState.isSubmitted,
                            })
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team key</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="DES"
                      maxLength={5}
                      className="w-32 font-mono uppercase"
                      onChange={event => {
                        setKeyEdited(true)
                        field.onChange(event.target.value.toUpperCase())
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Creating...' : 'Create team'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
