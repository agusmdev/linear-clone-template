/**
 * View state of an issue list/board (layout, grouping, ordering, filters,
 * search), kept in the URL search params so a view can be shared and survives
 * a reload. Defaults are left out of the URL.
 *
 *   ?layout=board&group=assignee&order=priority&subs=hide&completed=hide
 *   &status=<id>,<id>&priority=urgent,high&assignee=me,none&creator=<id>&label=<id>
 *
 * Values are words or ids, never bare numbers or booleans: the router would
 * JSON-quote those in the URL.
 *   &project=<id>,none&cycle=<id>&q=crash
 */
import type { IssueOrderBy, IssuePriority, IssuesParams } from '@/types/issue'
import type { WorkflowStateType } from '@/types/team'

export type IssueLayout = 'list' | 'board'
export type IssueGrouping = 'status' | 'assignee' | 'priority' | 'project' | 'none'
export type IssueOrdering = 'manual' | 'priority' | 'created' | 'updated' | 'due_date'

export const FILTER_KINDS = [
  'status',
  'priority',
  'assignee',
  'creator',
  'label',
  'project',
  'cycle',
] as const
export type FilterKind = (typeof FILTER_KINDS)[number]
export type IssueFilters = Record<FilterKind, string[]>

export interface IssueViewState {
  layout: IssueLayout
  grouping: IssueGrouping
  ordering: IssueOrdering
  showSubIssues: boolean
  showCompleted: boolean
  filters: IssueFilters
  search: string
}

export const GROUPING_LABELS: Record<IssueGrouping, string> = {
  status: 'Status',
  assignee: 'Assignee',
  priority: 'Priority',
  project: 'Project',
  none: 'No grouping',
}

export const ORDERING_LABELS: Record<IssueOrdering, string> = {
  manual: 'Manual',
  priority: 'Priority',
  created: 'Created',
  updated: 'Updated',
  due_date: 'Due date',
}

export const FILTER_LABELS: Record<FilterKind, string> = {
  status: 'Status',
  priority: 'Priority',
  assignee: 'Assignee',
  creator: 'Creator',
  label: 'Labels',
  project: 'Project',
  cycle: 'Cycle',
}

const LAYOUTS: IssueLayout[] = ['list', 'board']
const HIDE = 'hide'
/** URL words of priorities 0..4. */
const PRIORITY_SLUGS = ['none', 'urgent', 'high', 'medium', 'low']
const GROUPINGS = Object.keys(GROUPING_LABELS) as IssueGrouping[]
const ORDERINGS = Object.keys(ORDERING_LABELS) as IssueOrdering[]

export interface ViewDefaults {
  layout?: IssueLayout
  grouping?: IssueGrouping
}

function text(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.map(String).join(',')
  return String(value)
}

function list(value: unknown): string[] {
  return text(value)
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
}

function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  const raw = text(value)
  return (allowed as string[]).includes(raw) ? (raw as T) : fallback
}

/** Reads the view state from the parsed URL search object. */
export function readViewState(
  search: Record<string, unknown>,
  defaults: ViewDefaults = {}
): IssueViewState {
  const filters = Object.fromEntries(
    FILTER_KINDS.map(kind => [kind, list(search[kind])])
  ) as IssueFilters
  // Priorities are words in the URL ("urgent") and numbers ("1") in the app.
  filters.priority = filters.priority
    .map(slug => String(PRIORITY_SLUGS.indexOf(slug)))
    .filter(value => value !== '-1')
  return {
    layout: oneOf(search.layout, LAYOUTS, defaults.layout ?? 'list'),
    grouping: oneOf(search.group, GROUPINGS, defaults.grouping ?? 'status'),
    ordering: oneOf(search.order, ORDERINGS, 'manual'),
    showSubIssues: text(search.subs) !== HIDE,
    showCompleted: text(search.completed) !== HIDE,
    filters,
    search: text(search.q),
  }
}

/** The URL search keys for a view state change (`undefined` removes a key = default). */
export function viewStateToSearch(
  state: IssueViewState,
  defaults: ViewDefaults = {}
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {
    layout: state.layout === (defaults.layout ?? 'list') ? undefined : state.layout,
    group: state.grouping === (defaults.grouping ?? 'status') ? undefined : state.grouping,
    order: state.ordering === 'manual' ? undefined : state.ordering,
    subs: state.showSubIssues ? undefined : HIDE,
    completed: state.showCompleted ? undefined : HIDE,
    q: state.search.trim() || undefined,
  }
  for (const kind of FILTER_KINDS) {
    const values =
      kind === 'priority'
        ? state.filters.priority.map(value => PRIORITY_SLUGS[Number(value)]).filter(Boolean)
        : state.filters[kind]
    out[kind] = values.length ? values.join(',') : undefined
  }
  return out
}

export function activeFilterCount(state: IssueViewState): number {
  return FILTER_KINDS.filter(kind => state.filters[kind].length > 0).length
}

const ORDER_BY: Record<IssueOrdering, IssueOrderBy[]> = {
  manual: ['sort_order'],
  priority: ['priority', 'sort_order'],
  created: ['-created_at'],
  updated: ['-updated_at'],
  due_date: ['due_date', 'sort_order'],
}

const OPEN_TYPES: WorkflowStateType[] = ['backlog', 'unstarted', 'started']
const ALL_TYPES: WorkflowStateType[] = [...OPEN_TYPES, 'completed', 'canceled']

/** The GET /issues query for a page's base params plus the view state. */
export function viewParams(base: IssuesParams, state: IssueViewState): IssuesParams {
  const { filters } = state
  const params: IssuesParams = { ...base, order_by: ORDER_BY[state.ordering] }
  if (filters.status.length) params.state_id__in = filters.status
  if (filters.priority.length)
    params.priority__in = filters.priority
      .map(Number)
      .filter(n => n >= 0 && n <= 4) as IssuePriority[]
  if (filters.assignee.length) params.assignee_id__in = filters.assignee
  if (filters.creator.length) params.creator_id__in = filters.creator
  if (filters.label.length) params.label_id__in = filters.label
  if (filters.project.length) params.project_id__in = filters.project
  if (filters.cycle.length) params.cycle_id__in = filters.cycle
  if (state.search.trim()) params.search = state.search.trim()
  if (!state.showSubIssues) params.parent_id__isnull = true
  if (!state.showCompleted) {
    params.state_type__in = (base.state_type__in ?? ALL_TYPES).filter(t => OPEN_TYPES.includes(t))
  }
  return params
}

/** Linear's priority order: urgent first, "no priority" last. */
export function priorityRank(priority: number): number {
  return priority === 0 ? 5 : priority
}
