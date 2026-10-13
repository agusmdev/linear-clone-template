import { createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { SettingsCard, SettingsPage, SettingsRow, SettingsSection } from '@/components/SettingsPage'
import { UserAvatar } from '@/components/UserAvatar'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme, type Theme } from '@/contexts/ThemeContext'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { useUpdateMe } from '@/hooks/useWorkspaceSettings'
import { toastApiError } from '@/lib/error-handler'
import { profileSchema, type ProfileFormData } from '@/features/workspaces/workspace-schemas'

/** Settings › Account (WS-7): display name, email, theme, log out. */
export const Route = createFileRoute('/_authed/$workspaceKey/settings/account')({
  component: AccountSettings,
})

function AccountSettings() {
  const { me } = useCurrentWorkspace()
  const { logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const updateMe = useUpdateMe()

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: { display_name: me.display_name },
  })

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateMe.mutateAsync({ display_name: data.display_name.trim() })
      toast.success('Profile updated')
    } catch (error) {
      toastApiError(error, 'Could not update your profile')
    }
  }

  const displayName = me.display_name || me.email

  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Settings' }]} title="Account" />
      <SettingsPage title="Account" description="Manage your profile and your preferences.">
        <SettingsSection title="Profile">
          <SettingsCard className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <UserAvatar name={displayName} size="xl" />
              <div className="min-w-0">
                <div className="truncate text-ui font-medium">{displayName}</div>
                <div className="truncate text-mini text-text-secondary">{me.email}</div>
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
                  name="display_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Your name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="account-email" className="text-mini font-medium text-foreground">
                    Email
                  </label>
                  <Input id="account-email" value={me.email} readOnly disabled />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={!form.formState.isDirty || updateMe.isPending}>
                    {updateMe.isPending ? 'Saving...' : 'Save changes'}
                  </Button>
                </div>
              </form>
            </Form>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title="Preferences">
          <SettingsCard>
            <SettingsRow label="Interface theme" description="Dark or light look for the app.">
              <Select value={theme} onValueChange={value => setTheme(value as Theme)}>
                <SelectTrigger size="sm" aria-label="Interface theme" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title="Session">
          <SettingsCard>
            <SettingsRow label="Log out" description={`Signed in as ${me.email}`}>
              <Button variant="outline" size="sm" onClick={() => void logout()}>
                <LogOut />
                Log out
              </Button>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>
      </SettingsPage>
    </>
  )
}
