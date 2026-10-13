import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowDown,
  ArrowUp,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { ColorPicker } from '@/components/ColorPicker'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { IconButton } from '@/components/IconButton'
import { PageHeader } from '@/components/PageHeader'
import { PropertyPicker } from '@/components/PropertyPicker'
import { SettingsCard, SettingsPage, SettingsRow, SettingsSection } from '@/components/SettingsPage'
import { StatusIcon } from '@/components/StatusIcon'
import { UserAvatar } from '@/components/UserAvatar'
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
  FormDescription,
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
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { useTeamStates } from '@/hooks/useWorkspace'
import {
  useAddTeamMember,
  useCreateWorkflowState,
  useDeleteTeam,
  useDeleteWorkflowState,
  useMyMembership,
  useRemoveTeamMember,
  useTeamMembers,
  useUpdateTeam,
  useUpdateWorkflowState,
} from '@/hooks/useWorkspaceSettings'
import { ApiError } from '@/lib/api-client'
import { toastApiError } from '@/lib/error-handler'
import { TeamBadge } from '@/features/workspaces/settings-nav'
import {
  positionForNewState,
  sortStates,
  STATE_TYPE_COLORS,
  STATE_TYPE_LABELS,
  STATE_TYPE_ORDER,
} from '@/features/workspaces/workflow'
import {
  COLOR_PALETTE,
  teamSchema,
  type TeamFormData,
} from '@/features/workspaces/workspace-schemas'
import type { Team, TeamMember, WorkflowState, WorkflowStateType } from '@/types/team'

/**
 * Settings › <team> (WS-4, WS-5): general (name, key, color, description),
 * members (join, leave, add, remove) and the workflow states.
 * Team members and workspace admins can change it; only admins delete it.
 */
export const Route = createFileRoute('/_authed/$workspaceKey/settings/team/$teamKey')({
  component: TeamSettings,
})

function TeamSettings() {
  const { teamKey } = Route.useParams()
  const { teams } = useCurrentWorkspace()
  const team = teams.find(t => t.key.toLowerCase() === teamKey.toLowerCase())

  if (!team) {
    return (
      <>
        <PageHeader breadcrumbs={[{ label: 'Settings' }, { label: 'Teams' }]} title={teamKey} />
        <EmptyState
          className="py-24"
          title="Team not found"
          description={`There is no team with the key ${teamKey} in this workspace.`}
        />
      </>
    )
  }
  return <TeamSettingsContent key={team.id} team={team} />
}

function TeamSettingsContent({ team }: { team: Team }) {
  const { me, path } = useCurrentWorkspace()
  const { isAdmin } = useMyMembership()
  const navigate = useNavigate()
  const membersQuery = useTeamMembers(team.id)
  const deleteTeam = useDeleteTeam(team.id)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const members = membersQuery.data ?? []
  const joined = members.some(member => member.user_id === me.id)
  const canManage = isAdmin || joined

  const onDelete = async () => {
    try {
      await deleteTeam.mutateAsync()
      toast.success(`Team ${team.name} deleted`)
      navigate({ to: path('/settings/teams') as '/', replace: true })
    } catch (error) {
      setConfirmDelete(false)
      toastApiError(error, 'Could not delete the team')
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Settings' }, { label: 'Teams', to: path('/settings/teams') }]}
        title={team.name}
        icon={<TeamBadge team={team} />}
      />
      <SettingsPage
        title={team.name}
        description={
          canManage
            ? 'Manage the team, its members and its workflow.'
            : 'Join the team to change its settings.'
        }
      >
        <GeneralSection team={team} canManage={canManage} />
        <MembersSection
          team={team}
          members={members}
          loading={membersQuery.isPending}
          joined={joined}
          canManage={canManage}
        />
        <WorkflowSection team={team} canManage={canManage} />
        {isAdmin ? (
          <SettingsSection title="Danger zone">
            <SettingsCard>
              <SettingsRow
                label="Delete team"
                description="Deletes the team with all its issues, cycles and workflow states."
              >
                <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                  Delete team
                </Button>
              </SettingsRow>
            </SettingsCard>
          </SettingsSection>
        ) : null}
      </SettingsPage>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete team ${team.name}?`}
        description={`Every issue of ${team.key} is deleted too. This cannot be undone.`}
        confirmLabel="Delete team"
        onConfirm={onDelete}
        pending={deleteTeam.isPending}
      />
    </>
  )
}

// --- General -------------------------------------------------------------------

function GeneralSection({ team, canManage }: { team: Team; canManage: boolean }) {
  const { path } = useCurrentWorkspace()
  const navigate = useNavigate()
  const updateTeam = useUpdateTeam(team.id)
  const form = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    values: {
      name: team.name,
      key: team.key,
      description: team.description ?? '',
      color: team.color ?? COLOR_PALETTE[1],
    },
  })

  const onSubmit = async (data: TeamFormData) => {
    try {
      const updated = await updateTeam.mutateAsync({
        name: data.name.trim(),
        key: data.key,
        description: data.description?.trim() ? data.description.trim() : null,
        color: data.color,
      })
      toast.success('Team updated')
      if (updated.key !== team.key) {
        navigate({ to: path(`/settings/team/${updated.key}`) as '/', replace: true })
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'duplicate_item') {
        form.setError('key', { message: 'Another team already uses this key' })
        return
      }
      toastApiError(error, 'Could not update the team')
    }
  }

  return (
    <SettingsSection title="General">
      <SettingsCard className="p-5">
        <Form {...form}>
          <form
            method="post"
            action="#"
            noValidate
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="flex items-start gap-3">
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem className="pt-[22px]">
                    <ColorPicker
                      label="Team color"
                      value={field.value}
                      onChange={color => field.onChange(color)}
                      disabled={!canManage}
                    />
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
                      <Input {...field} disabled={!canManage} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem className="w-28">
                    <FormLabel>Team key</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        maxLength={5}
                        disabled={!canManage}
                        className="font-mono uppercase"
                        onChange={event => field.onChange(event.target.value.toUpperCase())}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="key"
              render={() => (
                <FormItem>
                  <FormDescription>
                    The key prefixes every issue ID of the team. A new key changes all of them
                    (ENG-12 becomes NEW-12).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={2}
                      placeholder="What does this team work on?"
                      disabled={!canManage}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {canManage ? (
              <div className="flex justify-end">
                <Button type="submit" disabled={!form.formState.isDirty || updateTeam.isPending}>
                  {updateTeam.isPending ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            ) : null}
          </form>
        </Form>
      </SettingsCard>
    </SettingsSection>
  )
}

// --- Members -------------------------------------------------------------------

interface MembersSectionProps {
  team: Team
  members: TeamMember[]
  loading: boolean
  joined: boolean
  canManage: boolean
}

function MembersSection({ team, members, loading, joined, canManage }: MembersSectionProps) {
  const { members: workspaceMembers, me } = useCurrentWorkspace()
  const addMember = useAddTeamMember(team.id)
  const removeMember = useRemoveTeamMember(team.id)

  const candidates = workspaceMembers.filter(
    member => !members.some(teamMember => teamMember.user_id === member.user_id)
  )

  const add = async (userId: string) => {
    const member = workspaceMembers.find(m => m.user_id === userId)
    try {
      await addMember.mutateAsync(userId === me.id ? undefined : userId)
      toast.success(
        userId === me.id
          ? `You joined ${team.name}`
          : `${member?.user.name || member?.user.email} added to ${team.name}`
      )
    } catch (error) {
      toastApiError(error, 'Could not add the member')
    }
  }

  const remove = async (member: TeamMember) => {
    const isMe = member.user_id === me.id
    try {
      await removeMember.mutateAsync(isMe ? 'me' : member.user_id)
      toast.success(
        isMe ? `You left ${team.name}` : `${member.user.name || member.user.email} removed`
      )
    } catch (error) {
      toastApiError(error, isMe ? 'Could not leave the team' : 'Could not remove the member')
    }
  }

  const myMembership = members.find(member => member.user_id === me.id)

  return (
    <SettingsSection
      title="Members"
      description={`${members.length} ${members.length === 1 ? 'member' : 'members'}`}
      actions={
        <>
          {joined && myMembership ? (
            <Button
              variant="outline"
              size="sm"
              disabled={removeMember.isPending}
              onClick={() => void remove(myMembership)}
            >
              Leave team
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={addMember.isPending}
              onClick={() => void add(me.id)}
            >
              Join team
            </Button>
          )}
          {canManage ? (
            <PropertyPicker
              label="Add member"
              placeholder="Add a workspace member..."
              emptyText="Everyone is already in the team"
              align="end"
              options={candidates.map(member => ({
                value: member.user_id,
                label: member.user.name || member.user.email,
                keywords: [member.user.email],
                icon: <UserAvatar name={member.user.name || member.user.email} size="xs" />,
              }))}
              value={null}
              onChange={userId => void add(userId)}
              trigger={
                <Button size="sm">
                  <UserPlus />
                  Add member
                </Button>
              }
            />
          ) : null}
        </>
      }
    >
      {loading ? (
        <SettingsCard>
          <Skeleton className="m-3 h-8" />
        </SettingsCard>
      ) : members.length === 0 ? (
        <SettingsCard>
          <p className="px-4 py-6 text-center text-ui text-text-secondary">
            Nobody is in this team yet.
          </p>
        </SettingsCard>
      ) : (
        <SettingsCard role="list" aria-label="Team members">
          {members.map(member => {
            const name = member.user.name || member.user.email
            const isMe = member.user_id === me.id
            return (
              <div
                key={member.id}
                role="listitem"
                aria-label={name}
                className="flex h-12 items-center gap-3 px-4"
              >
                <UserAvatar name={name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-ui text-foreground">
                    {name}
                    {isMe ? <span className="ml-1.5 text-text-tertiary">(you)</span> : null}
                  </div>
                  <div className="truncate text-mini text-text-secondary">{member.user.email}</div>
                </div>
                {canManage && !isMe ? (
                  <IconButton
                    label={`Remove ${name} from the team`}
                    icon={<UserMinus />}
                    size="sm"
                    onClick={() => void remove(member)}
                  />
                ) : null}
              </div>
            )
          })}
        </SettingsCard>
      )}
    </SettingsSection>
  )
}

// --- Workflow ------------------------------------------------------------------

function WorkflowSection({ team, canManage }: { team: Team; canManage: boolean }) {
  const statesQuery = useTeamStates(team.id)
  const createState = useCreateWorkflowState(team.id)
  const updateState = useUpdateWorkflowState()
  const [addingType, setAddingType] = useState<WorkflowStateType | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<WorkflowState | null>(null)

  const states = useMemo(() => sortStates(statesQuery.data ?? []), [statesQuery.data])

  const onCreate = async (type: WorkflowStateType, name: string, color: string) => {
    await createState.mutateAsync({
      name,
      type,
      color,
      position: positionForNewState(states, type),
    })
    toast.success(`Status ${name} added`)
    setAddingType(null)
  }

  const onRename = async (state: WorkflowState, name: string, color: string) => {
    await updateState.mutateAsync({ stateId: state.id, name, color })
    setEditingId(null)
  }

  const recolor = (state: WorkflowState, color: string) =>
    updateState
      .mutateAsync({ stateId: state.id, color })
      .catch(error => toastApiError(error, 'Could not change the color'))

  /** Swap the positions of a state and its neighbor in the same category. */
  const move = async (group: WorkflowState[], index: number, delta: -1 | 1) => {
    const state = group[index]
    const other = group[index + delta]
    if (!state || !other) return
    let a = other.position
    let b = state.position
    if (a === b) {
      // Equal positions: spread them apart so the order is defined.
      a = state.position + delta * 0.5
      b = state.position
    }
    try {
      await updateState.mutateAsync({ stateId: state.id, position: a })
      await updateState.mutateAsync({ stateId: other.id, position: b })
    } catch (error) {
      toastApiError(error, 'Could not reorder the statuses')
    }
  }

  return (
    <SettingsSection
      title="Workflow"
      description="Issue statuses of the team, grouped by category. The board shows them in this order."
    >
      {statesQuery.isPending ? (
        <SettingsCard>
          <Skeleton className="m-3 h-8" />
        </SettingsCard>
      ) : (
        <div className="flex flex-col gap-4">
          {STATE_TYPE_ORDER.map(type => {
            const group = states.filter(state => state.type === type)
            return (
              <div key={type} role="group" aria-label={STATE_TYPE_LABELS[type]}>
                <div className="mb-1.5 flex h-7 items-center justify-between px-1">
                  <h4 className="text-mini font-medium text-text-secondary">
                    {STATE_TYPE_LABELS[type]}
                  </h4>
                  {canManage ? (
                    <IconButton
                      label={`Add status to ${STATE_TYPE_LABELS[type]}`}
                      icon={<Plus />}
                      size="sm"
                      onClick={() => {
                        setEditingId(null)
                        setAddingType(type)
                      }}
                    />
                  ) : null}
                </div>
                <SettingsCard role="list" aria-label={`${STATE_TYPE_LABELS[type]} statuses`}>
                  {group.length === 0 && addingType !== type ? (
                    <p className="px-4 py-2.5 text-mini text-text-tertiary">No statuses</p>
                  ) : null}
                  {group.map((state, index) =>
                    editingId === state.id ? (
                      <StateEditor
                        key={state.id}
                        type={type}
                        initialName={state.name}
                        initialColor={state.color}
                        submitLabel="Save"
                        onCancel={() => setEditingId(null)}
                        onSubmit={(name, color) => onRename(state, name, color)}
                      />
                    ) : (
                      <div
                        key={state.id}
                        role="listitem"
                        aria-label={state.name}
                        className="group flex h-10 items-center gap-2 px-3"
                      >
                        <ColorPicker
                          label={`Color of ${state.name}`}
                          value={state.color}
                          disabled={!canManage}
                          onChange={color => void recolor(state, color)}
                          trigger={
                            <button
                              type="button"
                              aria-label={`Color of ${state.name}: ${state.color}`}
                              className="flex size-6 items-center justify-center rounded-md hover:bg-surface-hover disabled:hover:bg-transparent"
                            >
                              <StatusIcon type={state.type} color={state.color} />
                            </button>
                          }
                        />
                        <span className="min-w-0 flex-1 truncate text-ui text-foreground">
                          {state.name}
                        </span>
                        {canManage ? (
                          <div className="flex items-center gap-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                            <IconButton
                              label={`Move ${state.name} up`}
                              icon={<ArrowUp />}
                              size="sm"
                              disabled={index === 0 || updateState.isPending}
                              onClick={() => void move(group, index, -1)}
                            />
                            <IconButton
                              label={`Move ${state.name} down`}
                              icon={<ArrowDown />}
                              size="sm"
                              disabled={index === group.length - 1 || updateState.isPending}
                              onClick={() => void move(group, index, 1)}
                            />
                          </div>
                        ) : null}
                        {canManage ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <IconButton
                                label={`Actions for ${state.name}`}
                                icon={<MoreHorizontal />}
                                size="sm"
                              />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => {
                                  setAddingType(null)
                                  setEditingId(state.id)
                                }}
                              >
                                <Pencil />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={states.length <= 1}
                                onSelect={() => setToDelete(state)}
                              >
                                <Trash2 />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    )
                  )}
                  {addingType === type ? (
                    <StateEditor
                      type={type}
                      initialName=""
                      initialColor={STATE_TYPE_COLORS[type]}
                      submitLabel="Add status"
                      onCancel={() => setAddingType(null)}
                      onSubmit={(name, color) => onCreate(type, name, color)}
                    />
                  ) : null}
                </SettingsCard>
              </div>
            )
          })}
        </div>
      )}
      {toDelete ? (
        <DeleteStateDialog state={toDelete} states={states} onClose={() => setToDelete(null)} />
      ) : null}
    </SettingsSection>
  )
}

interface StateEditorProps {
  type: WorkflowStateType
  initialName: string
  initialColor: string
  submitLabel: string
  onCancel: () => void
  /** Rejects with the API error; the editor shows it. */
  onSubmit: (name: string, color: string) => Promise<void>
}

/** Inline row to add or rename a status: color + name + buttons. */
function StateEditor({
  type,
  initialName,
  initialColor,
  submitLabel,
  onCancel,
  onSubmit,
}: StateEditorProps) {
  const [name, setName] = useState(initialName)
  const [color, setColor] = useState(initialColor)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Focus the name when the row opens.
  useEffect(() => inputRef.current?.focus(), [])

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Status name is required')
      return
    }
    setPending(true)
    try {
      await onSubmit(trimmed, color)
    } catch (err) {
      toastApiError(err, 'Could not save the status')
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      role="listitem"
      aria-label={initialName ? `Edit ${initialName}` : 'New status'}
      className="flex flex-col gap-1 bg-surface-hover/50 px-3 py-2"
      onSubmit={event => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className="flex items-center gap-2">
        <ColorPicker
          label="Status color"
          value={color}
          onChange={setColor}
          trigger={
            <button
              type="button"
              aria-label={`Status color: ${color}`}
              className="flex size-6 items-center justify-center rounded-md hover:bg-surface-hover"
            >
              <StatusIcon type={type} color={color} />
            </button>
          }
        />
        <Input
          aria-label="Status name"
          ref={inputRef}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onCancel()
            }
          }}
          placeholder="Status name"
          value={name}
          onChange={event => {
            setName(event.target.value)
            setError(null)
          }}
          className="h-7 flex-1"
        />
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="pl-8 text-mini text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}

interface DeleteStateDialogProps {
  state: WorkflowState
  states: WorkflowState[]
  onClose: () => void
}

/** Delete a status; its issues move to the status the user picks. */
function DeleteStateDialog({ state, states, onClose }: DeleteStateDialogProps) {
  const deleteState = useDeleteWorkflowState()
  const others = states.filter(s => s.id !== state.id)
  const fallback = others.find(s => s.type === state.type) ?? others[0]
  const [target, setTarget] = useState(fallback?.id ?? '')

  const onConfirm = async () => {
    try {
      await deleteState.mutateAsync({ stateId: state.id, moveToStateId: target || undefined })
      toast.success(`Status ${state.name} deleted`)
      onClose()
    } catch (error) {
      onClose()
      toastApiError(error, 'Could not delete the status')
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={open => {
        if (!open) onClose()
      }}
      title={`Delete status ${state.name}?`}
      description="Issues with this status move to the status you choose below."
      confirmLabel="Delete status"
      onConfirm={onConfirm}
      pending={deleteState.isPending}
      canConfirm={!!target}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-mini text-text-secondary">Move its issues to</span>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger aria-label="Move issues to" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {others.map(s => (
              <SelectItem key={s.id} value={s.id}>
                <StatusIcon type={s.type} color={s.color} />
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </ConfirmDialog>
  )
}
