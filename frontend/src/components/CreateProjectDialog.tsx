import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RichTextEditor } from '@/components/editor'
import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
  ProjectIconPicker,
} from '@/components/ProjectIcon'
import {
  ProjectDatePicker,
  ProjectLeadPicker,
  ProjectStatusPicker,
  ProjectTeamsPicker,
} from '@/components/ProjectPropertyPickers'
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
import {
  projectFormToPayload,
  projectSchema,
  type ProjectFormData,
} from '@/features/projects/project-schemas'
import { useCreateProject } from '@/hooks/useProjects'
import { toastApiError } from '@/lib/error-handler'
import type { Project } from '@/types/project'
import type { Team } from '@/types/team'
import type { WorkspaceMember } from '@/types/workspace'

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  teams: Team[]
  members: WorkspaceMember[]
  /** Pre-selected team (the team projects page). */
  defaultTeamId?: string
  onCreated?: (project: Project) => void
}

function emptyForm(defaultTeamId?: string): ProjectFormData {
  return {
    name: '',
    description: '',
    status: 'planned',
    lead_id: null,
    start_date: null,
    target_date: null,
    team_ids: defaultTeamId ? [defaultTeamId] : [],
    icon: DEFAULT_PROJECT_ICON,
    color: DEFAULT_PROJECT_COLOR,
  }
}

/** Linear's "New project" modal: icon, name, description and the property chips. */
export function CreateProjectDialog({
  open,
  onOpenChange,
  workspaceId,
  teams,
  members,
  defaultTeamId,
  onCreated,
}: CreateProjectDialogProps) {
  const createProject = useCreateProject()
  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: emptyForm(defaultTeamId),
  })

  const handleOpenChange = (next: boolean) => {
    if (!next) form.reset(emptyForm(defaultTeamId))
    onOpenChange(next)
  }

  const onSubmit = async (data: ProjectFormData) => {
    try {
      const project = await createProject.mutateAsync(projectFormToPayload(workspaceId, data))
      form.reset(emptyForm(defaultTeamId))
      onOpenChange(false)
      onCreated?.(project)
    } catch (error) {
      toastApiError(error, 'Could not create project')
    }
  }

  const icon = useWatch({ control: form.control, name: 'icon' })
  const color = useWatch({ control: form.control, name: 'color' })
  const startDate = useWatch({ control: form.control, name: 'start_date' })
  const targetDate = useWatch({ control: form.control, name: 'target_date' })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="gap-3 sm:max-w-2xl"
        onOpenAutoFocus={event => {
          event.preventDefault()
          form.setFocus('name')
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-mini font-normal text-text-secondary">
            New project
          </DialogTitle>
          <DialogDescription className="sr-only">
            Name the project and set its status, lead, dates and teams.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            method="post"
            action="#"
            noValidate
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <ProjectIconPicker
              icon={icon}
              color={color}
              size={18}
              className="size-9"
              onChange={value => {
                form.setValue('icon', value.icon)
                form.setValue('color', value.color)
              }}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Project name</FormLabel>
                  <FormControl>
                    <input
                      {...field}
                      autoComplete="off"
                      placeholder="Project name"
                      className="w-full bg-transparent text-title font-semibold text-foreground outline-none placeholder:text-text-tertiary"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Add description…"
                  ariaLabel="Project description"
                  className="max-h-64 min-h-20 overflow-y-auto"
                />
              )}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <ProjectStatusPicker value={field.value} onChange={field.onChange} />
                )}
              />
              <FormField
                control={form.control}
                name="lead_id"
                render={({ field }) => (
                  <ProjectLeadPicker
                    members={members}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <ProjectDatePicker
                    label="Start date"
                    value={field.value}
                    max={targetDate}
                    onChange={field.onChange}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="target_date"
                render={({ field }) => (
                  <ProjectDatePicker
                    label="Target date"
                    value={field.value}
                    min={startDate}
                    onChange={field.onChange}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="team_ids"
                render={({ field }) => (
                  <ProjectTeamsPicker teams={teams} value={field.value} onChange={field.onChange} />
                )}
              />
            </div>
            {form.formState.errors.target_date ? (
              <p role="alert" className="text-mini text-destructive">
                {form.formState.errors.target_date.message}
              </p>
            ) : null}
            <DialogFooter className="border-t border-border-subtle pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createProject.isPending}>
                {createProject.isPending ? 'Creating…' : 'Create project'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
