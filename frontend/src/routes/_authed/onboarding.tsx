import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight } from 'lucide-react'
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
import { useAuth } from '@/contexts/AuthContext'
import { useMe, useWorkspaces } from '@/hooks/useWorkspace'
import { useCreateWorkspace } from '@/hooks/useWorkspaceSettings'
import { ApiError } from '@/lib/api-client'
import { toastApiError } from '@/lib/error-handler'
import {
  deriveUrlKey,
  workspaceSchema,
  type WorkspaceFormData,
} from '@/features/workspaces/workspace-schemas'

/**
 * WS-1: create a workspace (name + URL key derived from the name). New users
 * land here after sign-up; the workspace switcher links here too
 * ("Create or join workspace"). The backend adds the first team, its
 * workflow states and default labels.
 */
// The _authed layout renders in the browser only (ssr: false), so `window` is there.
export const Route = createFileRoute('/_authed/onboarding')({
  staticData: { appShell: true },
  component: OnboardingPage,
})

function OnboardingPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const me = useMe()
  const workspaces = useWorkspaces()
  const createWorkspace = useCreateWorkspace()
  // The URL follows the name until the user edits the URL.
  const [urlEdited, setUrlEdited] = useState(false)

  const form = useForm<WorkspaceFormData>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: '', url_key: '' },
  })
  const name = useWatch({ control: form.control, name: 'name' })

  const onSubmit = async (data: WorkspaceFormData) => {
    try {
      const workspace = await createWorkspace.mutateAsync({
        name: data.name.trim(),
        url_key: data.url_key,
      })
      navigate({ to: `/${workspace.url_key}/my-issues` as '/' })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'duplicate_item') {
        form.setError('url_key', { message: 'This URL is already taken' })
        return
      }
      toastApiError(error, 'Could not create the workspace')
    }
  }

  const existing = workspaces.data ?? []

  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--primary)_14%,transparent),transparent_65%)]"
      />
      <header className="relative flex h-14 items-center justify-between px-6">
        <span className="text-ui font-semibold">Linear Clone</span>
        <div className="flex items-center gap-3 text-mini text-text-secondary">
          {me.data ? (
            <span>
              Logged in as <span className="text-foreground">{me.data.email}</span>
            </span>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      </header>

      <main className="relative flex flex-1 items-start justify-center px-4 pt-[8vh] pb-16">
        <div className="w-full max-w-[420px]">
          <div className="flex flex-col items-center text-center">
            <WorkspaceLogo name={name.trim() || 'Workspace'} size="lg" />
            <h1 className="mt-6 text-[24px] leading-tight font-semibold tracking-[-0.01em]">
              Create a new workspace
            </h1>
            <p className="mt-2 max-w-sm text-ui text-text-secondary">
              Workspaces are shared environments where teams can work on projects, cycles and
              issues.
            </p>
          </div>

          <div className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-popover">
            <Form {...form}>
              <form
                method="post"
                action="#"
                noValidate
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workspace name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Acme Inc."
                          onChange={event => {
                            field.onChange(event)
                            if (!urlEdited) {
                              form.setValue('url_key', deriveUrlKey(event.target.value), {
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
                <FormField
                  control={form.control}
                  name="url_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workspace URL</FormLabel>
                      <div className="flex h-8 items-center rounded-md border border-border bg-input focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
                        <span className="pl-2.5 text-ui text-text-tertiary select-none">
                          {window.location.host}/
                        </span>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="acme"
                            className="h-full border-0 bg-transparent pl-0.5 shadow-none focus-visible:ring-0"
                            onChange={event => {
                              setUrlEdited(true)
                              field.onChange(event.target.value.toLowerCase())
                            }}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={createWorkspace.isPending}
                >
                  {createWorkspace.isPending ? 'Creating workspace...' : 'Create workspace'}
                </Button>
              </form>
            </Form>
          </div>

          {existing.length > 0 ? (
            <section aria-labelledby="your-workspaces" className="mt-8">
              <h2 id="your-workspaces" className="mb-2 text-mini font-medium text-text-tertiary">
                Or open one of your workspaces
              </h2>
              <ul className="overflow-hidden rounded-lg border border-border">
                {existing.map(workspace => (
                  <li key={workspace.id} className="border-b border-border-subtle last:border-b-0">
                    <Link
                      to={`/${workspace.url_key}/my-issues` as '/'}
                      className="flex h-11 items-center gap-3 px-3 text-ui hover:bg-surface-hover"
                    >
                      <WorkspaceLogo name={workspace.name} size="md" />
                      <span className="min-w-0 flex-1 truncate font-medium">{workspace.name}</span>
                      <span className="text-mini text-text-tertiary">/{workspace.url_key}</span>
                      <ArrowRight className="size-4 text-text-tertiary" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  )
}
