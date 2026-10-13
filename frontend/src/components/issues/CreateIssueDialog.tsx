import { useState, type ReactNode } from 'react'
import { useForm, useWatch, type PathValue } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  CalendarClock,
  ChevronRight,
  Hexagon,
  RefreshCcw,
  Tag,
  Triangle,
  UserRound,
  X,
} from 'lucide-react'
import { RichTextEditor } from '@/components/editor'
import { Kbd } from '@/components/Kbd'
import { PriorityIcon, PRIORITY_LABELS } from '@/components/PriorityIcon'
import { PropertyPicker, type PropertyOption } from '@/components/PropertyPicker'
import { UserAvatar } from '@/components/UserAvatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import {
  createIssueFormToPayload,
  createIssueSchema,
  singleLineTitle,
  type CreateIssueFormData,
} from '@/features/issues/issue-schemas'
import type { NamedRef } from '@/hooks/useIssueRefs'
import { cn } from '@/lib/utils'
import type { CreateIssueData, CreateIssueEventDetail, Issue, IssuePriority } from '@/types/issue'
import type { Label } from '@/types/label'
import type { Team, WorkflowState } from '@/types/team'
import type { WorkspaceMember } from '@/types/workspace'
import {
  assigneeOptions,
  cycleOptions,
  estimateOptions,
  formatShortDate,
  isoDate,
  LabelDot,
  memberName,
  NONE,
  priorityOptions,
  ProjectIcon,
  StateIcon,
  statusOptions,
} from './issue-options'

export interface CreateIssueDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Defaults (from the `linear:create-issue` event). */
  defaults: CreateIssueEventDetail & { teamId: string }
  teams: Team[]
  /** States of every team. */
  states: WorkflowState[]
  members: WorkspaceMember[]
  labels: Label[]
  projects: NamedRef[]
  cycles: NamedRef[]
  meId: string
  /** Candidate parent issues of the selected team. */
  parentCandidates: Issue[]
  /** Called when the team changes (to load its parent candidates). */
  onTeamChange?: (teamId: string) => void
  /** Creates the issue; resolves with the new issue. */
  onCreate: (data: CreateIssueData) => Promise<Issue>
  pending: boolean
}

const chipClass =
  'inline-flex h-7 max-w-56 items-center gap-1.5 rounded-md border border-border px-2 text-mini text-text-secondary outline-none hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=open]:bg-surface-active [&_svg]:size-3.5 [&_svg]:shrink-0'

function Chip({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & React.ComponentProps<'button'>) {
  return (
    <button type="button" aria-label={label} className={chipClass} {...props}>
      {children}
    </button>
  )
}

/**
 * Linear's "New issue" modal (ISS-1): team chip, title, rich description,
 * property chips (status, priority, assignee, labels, project, cycle,
 * estimate, due date, parent), "Create more" and Cmd+Enter to submit.
 */
export function CreateIssueDialog({
  open,
  onOpenChange,
  defaults,
  teams,
  states,
  members,
  labels,
  projects,
  cycles,
  meId,
  parentCandidates,
  onTeamChange,
  onCreate,
  pending,
}: CreateIssueDialogProps) {
  const [createMore, setCreateMore] = useState(false)
  const [editorKey, setEditorKey] = useState(0)

  const form = useForm<CreateIssueFormData>({
    resolver: zodResolver(createIssueSchema),
    defaultValues: {
      team_id: defaults.teamId,
      title: '',
      description: '',
      state_id: defaults.stateId ?? null,
      priority: 0,
      assignee_id: defaults.assigneeId ?? null,
      label_ids: [],
      project_id: defaults.projectId ?? null,
      cycle_id: defaults.cycleId ?? null,
      parent_id: defaults.parentId ?? null,
      estimate: null,
      due_date: null,
    },
  })
  const values = useWatch({ control: form.control }) as CreateIssueFormData
  const set = <K extends keyof CreateIssueFormData>(key: K, value: CreateIssueFormData[K]) =>
    form.setValue(key, value as PathValue<CreateIssueFormData, K>, { shouldDirty: true })

  const team = teams.find(t => t.id === values.team_id) ?? teams[0]
  const teamStates = states
    .filter(s => s.team_id === team?.id)
    .sort((a, b) => a.position - b.position)
  const defaultState = teamStates.find(s => s.type === 'unstarted') ?? teamStates[0]
  const state = teamStates.find(s => s.id === values.state_id) ?? defaultState
  const assignee = members.find(m => m.user_id === values.assignee_id)
  const pickedLabels = labels.filter(l => values.label_ids.includes(l.id))
  const project = projects.find(p => p.id === values.project_id)
  const teamCycles = cycles.filter(c => (!c.team_id || c.team_id === team?.id) && !c.past)
  const cycle = teamCycles.find(c => c.id === values.cycle_id)
  const parent = parentCandidates.find(i => i.id === values.parent_id)

  const submit = form.handleSubmit(async data => {
    try {
      await onCreate(createIssueFormToPayload(data))
    } catch {
      return // the host shows the error toast
    }
    if (createMore) {
      form.reset({ ...data, title: '', description: '' })
      setEditorKey(k => k + 1)
      form.setFocus('title')
    } else {
      onOpenChange(false)
    }
  })

  const teamOptions: PropertyOption[] = teams.map(t => ({
    value: t.id,
    label: t.name,
    keywords: [t.key],
    icon: (
      <span className="flex size-4 items-center justify-center rounded bg-surface-active text-[9px] font-semibold">
        {t.key.slice(0, 2)}
      </span>
    ),
  }))
  const parentOptions: PropertyOption[] = [
    { value: NONE, label: 'No parent' },
    ...parentCandidates.map(issue => ({
      value: issue.id,
      label: `${issue.identifier} ${issue.title}`,
      keywords: [issue.identifier],
      icon: <StateIcon state={issue.state} />,
    })),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-label="New issue"
        className="top-[10%] translate-y-0 gap-0 p-0 sm:max-w-[760px]"
        onKeyDown={event => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            void submit()
          }
        }}
      >
        <Form {...form}>
          <form onSubmit={submit} noValidate className="flex flex-col">
            <div className="flex items-center gap-1.5 px-4 pt-3.5 pb-1">
              <PropertyPicker
                label="Team"
                placeholder="Pick a team..."
                options={teamOptions}
                value={values.team_id}
                onChange={teamId => {
                  if (teamId === values.team_id) return
                  set('team_id', teamId)
                  set('state_id', null)
                  set('cycle_id', null)
                  set('parent_id', null)
                  onTeamChange?.(teamId)
                }}
                trigger={
                  <button
                    type="button"
                    aria-label={`Team: ${team?.name ?? ''}`}
                    className="inline-flex h-6 items-center gap-1.5 rounded-md border border-border px-1.5 text-mini font-medium text-foreground hover:bg-surface-hover"
                  >
                    <span className="flex size-4 items-center justify-center rounded bg-surface-active text-[9px] font-semibold">
                      {team?.key.slice(0, 2)}
                    </span>
                    {team?.key}
                  </button>
                }
              />
              <ChevronRight className="size-3 text-text-tertiary" aria-hidden />
              <DialogTitle className="text-mini font-normal text-text-secondary">
                New issue
              </DialogTitle>
              <DialogDescription className="sr-only">
                Write a title and description, set the properties and create the issue.
              </DialogDescription>
              <button
                type="button"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
                className="ml-auto rounded-md p-1 text-text-secondary hover:bg-surface-hover hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="px-5 pt-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <textarea
                        {...field}
                        rows={1}
                        aria-label="Issue title"
                        placeholder="Issue title"
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                        // Titles are one line: a pasted line break becomes a space.
                        onChange={event => field.onChange(singleLineTitle(event.target.value))}
                        onKeyDown={event => {
                          if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey)
                            event.preventDefault()
                        }}
                        className="field-sizing-content w-full resize-none bg-transparent text-title font-medium text-foreground outline-none placeholder:text-text-tertiary"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <RichTextEditor
                key={editorKey}
                value={values.description}
                onChange={html => set('description', html)}
                placeholder="Add description…"
                ariaLabel="Issue description"
                className="mt-1 max-h-[40vh] min-h-20 overflow-y-auto"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-3">
              <PropertyPicker
                label="Status"
                placeholder="Change status..."
                options={statusOptions(teamStates)}
                value={state?.id ?? null}
                onChange={stateId => set('state_id', stateId)}
                trigger={
                  <Chip label={`Status: ${state?.name ?? ''}`}>
                    {state ? <StateIcon state={state} teamStates={teamStates} /> : null}
                    {state?.name}
                  </Chip>
                }
              />
              <PropertyPicker
                label="Priority"
                placeholder="Set priority to..."
                options={priorityOptions()}
                value={String(values.priority)}
                onChange={value => set('priority', Number(value))}
                trigger={
                  <Chip label={`Priority: ${PRIORITY_LABELS[values.priority as IssuePriority]}`}>
                    <PriorityIcon priority={values.priority as IssuePriority} />
                    {values.priority === 0
                      ? 'Priority'
                      : PRIORITY_LABELS[values.priority as IssuePriority]}
                  </Chip>
                }
              />
              <PropertyPicker
                label="Assignee"
                placeholder="Assign to..."
                options={assigneeOptions(members, { meId })}
                value={values.assignee_id ?? NONE}
                onChange={value => set('assignee_id', value === NONE ? null : value)}
                trigger={
                  <Chip label={`Assignee: ${assignee ? memberName(assignee) : 'Unassigned'}`}>
                    {assignee ? (
                      <UserAvatar name={memberName(assignee)} size="xs" />
                    ) : (
                      <UserRound />
                    )}
                    {assignee ? memberName(assignee) : 'Assignee'}
                  </Chip>
                }
              />
              <PropertyPicker
                multiple
                label="Labels"
                placeholder="Add labels..."
                options={labels.map(l => ({
                  value: l.id,
                  label: l.name,
                  icon: <LabelDot color={l.color} />,
                }))}
                value={values.label_ids}
                onChange={ids => set('label_ids', ids)}
                trigger={
                  <Chip label={`Labels: ${pickedLabels.map(l => l.name).join(', ') || 'none'}`}>
                    {pickedLabels.length ? (
                      <>
                        <span className="flex -space-x-0.5">
                          {pickedLabels.slice(0, 3).map(l => (
                            <LabelDot key={l.id} color={l.color} />
                          ))}
                        </span>
                        <span className="truncate">
                          {pickedLabels.length <= 2
                            ? pickedLabels.map(l => l.name).join(', ')
                            : `${pickedLabels.length} labels`}
                        </span>
                      </>
                    ) : (
                      <>
                        <Tag />
                        Labels
                      </>
                    )}
                  </Chip>
                }
              />
              <PropertyPicker
                label="Project"
                placeholder="Add to project..."
                emptyText="No projects"
                options={[
                  { value: NONE, label: 'No project' },
                  ...projects.map(p => ({
                    value: p.id,
                    label: p.name,
                    icon: <ProjectIcon color={p.color} />,
                  })),
                ]}
                value={values.project_id ?? NONE}
                onChange={value => set('project_id', value === NONE ? null : value)}
                trigger={
                  <Chip label={`Project: ${project?.name ?? 'none'}`}>
                    {project ? <ProjectIcon color={project.color} /> : <Hexagon />}
                    {project?.name ?? 'Project'}
                  </Chip>
                }
              />
              <PropertyPicker
                label="Cycle"
                placeholder="Add to cycle..."
                options={cycleOptions(teamCycles)}
                value={values.cycle_id ?? NONE}
                onChange={value => set('cycle_id', value === NONE ? null : value)}
                trigger={
                  <Chip label={`Cycle: ${cycle?.name ?? 'none'}`}>
                    <RefreshCcw />
                    {cycle?.name ?? 'Cycle'}
                  </Chip>
                }
              />
              <PropertyPicker
                label="Estimate"
                placeholder="Set estimate..."
                options={estimateOptions()}
                value={values.estimate === null ? NONE : String(values.estimate)}
                onChange={value => set('estimate', value === NONE ? null : Number(value))}
                trigger={
                  <Chip label={`Estimate: ${values.estimate ?? 'none'}`}>
                    <Triangle />
                    {values.estimate === null ? 'Estimate' : `${values.estimate} pts`}
                  </Chip>
                }
              />
              <DueDatePicker value={values.due_date} onChange={value => set('due_date', value)} />
              <PropertyPicker
                label="Parent issue"
                placeholder="Set parent issue..."
                emptyText="No issues"
                contentClassName="w-80"
                options={parentOptions}
                value={values.parent_id ?? NONE}
                onChange={value => set('parent_id', value === NONE ? null : value)}
                trigger={
                  <Chip label={`Parent issue: ${parent?.identifier ?? 'none'}`}>
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M4 3v6a2 2 0 0 0 2 2h6M9 8l3 3-3 3"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {parent ? <span className="truncate">{parent.identifier}</span> : 'Parent'}
                  </Chip>
                }
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border-subtle px-4 py-2.5">
              <div className="flex items-center gap-2 text-mini text-text-secondary">
                <Switch
                  aria-label="Create more"
                  checked={createMore}
                  onCheckedChange={setCreateMore}
                  className="scale-90"
                />
                <span aria-hidden>Create more</span>
              </div>
              <Button type="submit" size="sm" disabled={pending} className="gap-2">
                {pending ? 'Creating...' : 'Create issue'}
                <span className="hidden items-center gap-0.5 sm:flex" aria-hidden>
                  <Kbd className="border-white/20 bg-white/10 text-primary-foreground">⌘</Kbd>
                  <Kbd className="border-white/20 bg-white/10 text-primary-foreground">↵</Kbd>
                </span>
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function DueDatePicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (value: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const pick = (next: string | null) => {
    onChange(next)
    setOpen(false)
  }
  const quick: [string, number][] = [
    ['Today', 0],
    ['Tomorrow', 1],
    ['In one week', 7],
    ['In two weeks', 14],
  ]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Chip label={`Due date: ${value ?? 'none'}`}>
          <CalendarClock />
          {value ? formatShortDate(value) : 'Due date'}
        </Chip>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5">
        <div className="flex flex-col">
          {quick.map(([text, days]) => (
            <button
              key={text}
              type="button"
              onClick={() => pick(isoDate(days))}
              className="flex h-8 items-center justify-between rounded-md px-2 text-ui hover:bg-surface-hover"
            >
              {text}
              <span className="text-mini text-text-tertiary">{formatShortDate(isoDate(days))}</span>
            </button>
          ))}
          <div className="my-1 border-t border-border-subtle" />
          <input
            type="date"
            aria-label="Due date"
            value={value ?? ''}
            onChange={event => {
              if (event.target.value) pick(event.target.value)
            }}
            className={cn(
              'h-8 rounded-md border border-border bg-input px-2 text-ui text-foreground [color-scheme:dark] light:[color-scheme:light]'
            )}
          />
          {value ? (
            <button
              type="button"
              onClick={() => pick(null)}
              className="mt-1 flex h-8 items-center rounded-md px-2 text-ui text-text-secondary hover:bg-surface-hover"
            >
              Remove due date
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
