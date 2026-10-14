import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LogOut, MoreHorizontal, Search, UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { IconButton } from '@/components/IconButton'
import { PageHeader } from '@/components/PageHeader'
import { SettingsCard, SettingsPage, SettingsSection } from '@/components/SettingsPage'
import { UserAvatar } from '@/components/UserAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import {
  useInviteMember,
  useMyMembership,
  useRemoveMember,
  useUpdateMember,
} from '@/hooks/useWorkspaceSettings'
import { ApiError } from '@/lib/api-client'
import { toastApiError } from '@/lib/error-handler'
import { inviteSchema, type InviteFormData } from '@/features/workspaces/workspace-schemas'
import type { WorkspaceMember, WorkspaceRole } from '@/types/workspace'

/** Settings › Members (WS-3): invite by email, roles, remove, leave. */
export const Route = createFileRoute('/_authed/$workspaceKey/settings/members')({
  component: MembersSettings,
})

const ROLE_LABELS: Record<WorkspaceRole, string> = { admin: 'Admin', member: 'Member' }

const dateFormat = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function MembersSettings() {
  const { workspace, members, me } = useCurrentWorkspace()
  const { isAdmin } = useMyMembership()
  const navigate = useNavigate()
  const updateMember = useUpdateMember(workspace.id)
  const removeMember = useRemoveMember(workspace.id)
  const [search, setSearch] = useState('')
  const [toRemove, setToRemove] = useState<WorkspaceMember | null>(null)

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return members
    return members.filter(
      member =>
        member.user.name.toLowerCase().includes(term) ||
        member.user.email.toLowerCase().includes(term)
    )
  }, [members, search])

  const changeRole = async (member: WorkspaceMember, role: WorkspaceRole) => {
    try {
      await updateMember.mutateAsync({ memberId: member.id, role })
      toast.success(
        `${member.user.name || member.user.email} is now ${ROLE_LABELS[role].toLowerCase()}`
      )
    } catch (error) {
      toastApiError(error, 'Could not change the role')
    }
  }

  const confirmRemove = async () => {
    if (!toRemove) return
    const leaving = toRemove.user_id === me.id
    try {
      await removeMember.mutateAsync(toRemove.id)
      setToRemove(null)
      if (leaving) {
        toast.success(`You left ${workspace.name}`)
        navigate({ to: '/', replace: true })
      } else {
        toast.success(`${toRemove.user.name || toRemove.user.email} was removed`)
      }
    } catch (error) {
      setToRemove(null)
      toastApiError(
        error,
        leaving ? 'Could not leave the workspace' : 'Could not remove the member'
      )
    }
  }

  const removingSelf = toRemove?.user_id === me.id

  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Settings' }]} title="Members" />
      <SettingsPage
        title="Members"
        description={`Manage who is a member of ${workspace.name} and what they can do.`}
      >
        {isAdmin ? <InviteForm workspaceId={workspace.id} /> : null}

        <SettingsSection
          title={`${members.length} ${members.length === 1 ? 'member' : 'members'}`}
          actions={
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-text-tertiary" />
              <Input
                aria-label="Search members"
                placeholder="Search by name or email"
                value={search}
                onChange={event => setSearch(event.target.value)}
                className="h-7 w-56 pl-7 text-mini"
              />
            </div>
          }
        >
          {visible.length === 0 ? (
            <EmptyState title="No members found" description="No member matches your search." />
          ) : (
            <SettingsCard role="list" aria-label="Members">
              {visible.map(member => {
                const isMe = member.user_id === me.id
                const displayName = member.user.name || member.user.email
                return (
                  <div
                    key={member.id}
                    role="listitem"
                    aria-label={displayName}
                    className="flex h-14 items-center gap-3 px-4"
                  >
                    <UserAvatar name={displayName} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-ui font-medium text-foreground">
                        {displayName}
                        {isMe ? <span className="ml-1.5 text-text-tertiary">(you)</span> : null}
                      </div>
                      <div className="truncate text-mini text-text-secondary">
                        {member.user.email}
                      </div>
                    </div>
                    <span className="hidden text-mini text-text-tertiary sm:inline">
                      Joined {dateFormat.format(new Date(member.created_at))}
                    </span>
                    {isAdmin ? (
                      <Select
                        value={member.role}
                        onValueChange={role => void changeRole(member, role as WorkspaceRole)}
                      >
                        <SelectTrigger
                          size="sm"
                          aria-label={`Role of ${displayName}`}
                          className="w-24"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">{ROLE_LABELS[member.role]}</Badge>
                    )}
                    {isAdmin || isMe ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <IconButton
                            label={`Actions for ${displayName}`}
                            icon={<MoreHorizontal />}
                            size="sm"
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setToRemove(member)}
                          >
                            {isMe ? <LogOut /> : <UserMinus />}
                            {isMe ? 'Leave workspace' : 'Remove from workspace'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="w-6" />
                    )}
                  </div>
                )
              })}
            </SettingsCard>
          )}
        </SettingsSection>
      </SettingsPage>

      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={open => {
          if (!open) setToRemove(null)
        }}
        title={
          removingSelf
            ? `Leave ${workspace.name}?`
            : `Remove ${toRemove?.user.name || toRemove?.user.email || ''}?`
        }
        description={
          removingSelf
            ? 'You will lose access to this workspace. An admin can add you again.'
            : 'They lose access to the workspace and leave all its teams. Their issues stay.'
        }
        confirmLabel={removingSelf ? 'Leave workspace' : 'Remove member'}
        onConfirm={confirmRemove}
        pending={removeMember.isPending}
      />
    </>
  )
}

function InviteForm({ workspaceId }: { workspaceId: string }) {
  const inviteMember = useInviteMember(workspaceId)
  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'member' },
  })

  const onSubmit = async (data: InviteFormData) => {
    try {
      const member = await inviteMember.mutateAsync({ email: data.email.trim(), role: data.role })
      toast.success(`${member.user.name || member.user.email} joined the workspace`)
      form.reset({ email: '', role: data.role })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'user_not_found') {
        // Focus the field again (the disabled Invite button dropped it), so Esc
        // does not leave Settings.
        form.setError(
          'email',
          { message: 'No account uses this email. Ask them to sign up first.' },
          { shouldFocus: true }
        )
        return
      }
      if (error instanceof ApiError && error.code === 'duplicate_item') {
        form.setError('email', { message: 'This user is already a member' }, { shouldFocus: true })
        return
      }
      toastApiError(error, 'Could not invite the member')
    }
  }

  return (
    <SettingsSection
      title="Invite members"
      description="People with an account join at once. No email is sent."
    >
      <SettingsCard className="p-4">
        <Form {...form}>
          <form
            method="post"
            action="#"
            noValidate
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3 sm:flex-row sm:items-start"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="sr-only">Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="email@example.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger aria-label="Role" className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <Button type="submit" disabled={inviteMember.isPending}>
              {inviteMember.isPending ? 'Inviting...' : 'Invite'}
            </Button>
          </form>
        </Form>
      </SettingsCard>
    </SettingsSection>
  )
}
