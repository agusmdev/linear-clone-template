import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
import { SettingsCard, SettingsPage, SettingsRow, SettingsSection } from '@/components/SettingsPage'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { WorkspaceLogo } from '@/components/WorkspaceSwitcher'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import {
  useDeleteWorkspace,
  useMyMembership,
  useRemoveMember,
  useUpdateWorkspace,
} from '@/hooks/useWorkspaceSettings'
import { ApiError } from '@/lib/api-client'
import { toastApiError } from '@/lib/error-handler'
import { workspaceSchema, type WorkspaceFormData } from '@/features/workspaces/workspace-schemas'

/** Settings › Workspace (general): name, URL key, leave, delete. */
export const Route = createFileRoute('/_authed/$workspaceKey/settings/')({
  component: WorkspaceGeneralSettings,
})

function WorkspaceGeneralSettings() {
  const { workspace } = useCurrentWorkspace()
  const { membership, isAdmin } = useMyMembership()
  const navigate = useNavigate()
  const updateWorkspace = useUpdateWorkspace(workspace.id)
  const deleteWorkspace = useDeleteWorkspace(workspace.id)
  const removeMember = useRemoveMember(workspace.id)
  const [confirm, setConfirm] = useState<'delete' | 'leave' | null>(null)
  const [typedName, setTypedName] = useState('')

  const form = useForm<WorkspaceFormData>({
    resolver: zodResolver(workspaceSchema),
    values: { name: workspace.name, url_key: workspace.url_key },
  })

  const onSubmit = async (data: WorkspaceFormData) => {
    try {
      const updated = await updateWorkspace.mutateAsync({
        name: data.name.trim(),
        url_key: data.url_key,
      })
      toast.success('Workspace updated')
      if (updated.url_key !== workspace.url_key) {
        navigate({ to: `/${updated.url_key}/settings` as '/', replace: true })
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'duplicate_item') {
        form.setError('url_key', { message: 'This URL is already taken' }, { shouldFocus: true })
        return
      }
      toastApiError(error, 'Could not update the workspace')
    }
  }

  const onDelete = async () => {
    try {
      await deleteWorkspace.mutateAsync()
      toast.success(`Workspace ${workspace.name} deleted`)
      navigate({ to: '/', replace: true })
    } catch (error) {
      toastApiError(error, 'Could not delete the workspace')
    }
  }

  const onLeave = async () => {
    if (!membership) return
    try {
      await removeMember.mutateAsync(membership.id)
      toast.success(`You left ${workspace.name}`)
      navigate({ to: '/', replace: true })
    } catch (error) {
      setConfirm(null)
      toastApiError(error, 'Could not leave the workspace')
    }
  }

  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Settings' }]} title="Workspace" />
      <SettingsPage title="Workspace" description="Manage the name and the URL of your workspace.">
        <SettingsSection title="General">
          <SettingsCard className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <WorkspaceLogo name={workspace.name} size="lg" />
              <div className="min-w-0">
                <div className="truncate text-ui font-medium">{workspace.name}</div>
                <div className="text-mini text-text-tertiary">
                  {window.location.host}/{workspace.url_key}
                </div>
              </div>
            </div>
            <Form {...form}>
              <form
                method="post"
                action="#"
                noValidate
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 !border-t-0"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workspace name</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!isAdmin} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="url_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workspace URL</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={!isAdmin}
                          onChange={event => field.onChange(event.target.value.toLowerCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isAdmin ? (
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={!form.formState.isDirty || updateWorkspace.isPending}
                    >
                      {updateWorkspace.isPending ? 'Saving...' : 'Save changes'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-mini text-text-tertiary">
                    Only admins can change the workspace settings.
                  </p>
                )}
              </form>
            </Form>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title="Danger zone">
          <SettingsCard>
            <SettingsRow
              label="Leave workspace"
              description="You lose access to its teams, issues and documents."
            >
              <Button variant="outline" size="sm" onClick={() => setConfirm('leave')}>
                Leave workspace
              </Button>
            </SettingsRow>
            {isAdmin ? (
              <SettingsRow
                label="Delete workspace"
                description="Deletes the workspace with all its teams, issues, projects and documents."
              >
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setTypedName('')
                    setConfirm('delete')
                  }}
                >
                  Delete workspace
                </Button>
              </SettingsRow>
            ) : null}
          </SettingsCard>
        </SettingsSection>
      </SettingsPage>

      <ConfirmDialog
        open={confirm === 'leave'}
        onOpenChange={open => setConfirm(open ? 'leave' : null)}
        title={`Leave ${workspace.name}?`}
        description="You will lose access to this workspace. An admin can add you again."
        confirmLabel="Leave workspace"
        onConfirm={onLeave}
        pending={removeMember.isPending}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={open => setConfirm(open ? 'delete' : null)}
        title={`Delete ${workspace.name}?`}
        description="This deletes every team, issue, project and document of the workspace. It cannot be undone."
        confirmLabel="Delete workspace"
        onConfirm={onDelete}
        pending={deleteWorkspace.isPending}
        canConfirm={typedName === workspace.name}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm-workspace-name" className="text-mini text-text-secondary">
            Type <span className="font-medium text-foreground">{workspace.name}</span> to confirm
          </label>
          <Input
            id="confirm-workspace-name"
            aria-label="Workspace name to confirm"
            value={typedName}
            onChange={event => setTypedName(event.target.value)}
          />
        </div>
      </ConfirmDialog>
    </>
  )
}
