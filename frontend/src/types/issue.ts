import type { LabelSummary } from '@/types/label'
import type { TeamSummary, WorkflowStateSummary, WorkflowStateType } from '@/types/team'
import type { UserSummary } from '@/types/user'

/** 0 no priority, 1 urgent, 2 high, 3 medium, 4 low. */
export type IssuePriority = 0 | 1 | 2 | 3 | 4

export const ISSUE_PRIORITY_LABELS: Record<IssuePriority, string> = {
  0: 'No priority',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
}

export interface Issue {
  id: string
  workspace_id: string
  team_id: string
  number: number
  /** `<team key>-<number>`, e.g. "ENG-12". */
  identifier: string
  title: string
  /** HTML from the TipTap editor. */
  description: string | null
  state_id: string
  priority: IssuePriority
  assignee_id: string | null
  creator_id: string | null
  project_id: string | null
  cycle_id: string | null
  parent_id: string | null
  estimate: number | null
  /** `YYYY-MM-DD`. */
  due_date: string | null
  sort_order: number
  started_at: string | null
  completed_at: string | null
  canceled_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  team: TeamSummary
  state: WorkflowStateSummary
  assignee: UserSummary | null
  creator: UserSummary | null
  labels: LabelSummary[]
}

/** A small issue reference (relations, notifications, search). Planned endpoints. */
export interface IssueRef {
  id: string
  identifier: string
  title: string
  state: WorkflowStateSummary
}

export interface CreateIssueData {
  team_id: string
  title: string
  description?: string | null
  /** Default: the team's first "unstarted" state (Todo). */
  state_id?: string
  priority?: IssuePriority
  assignee_id?: string | null
  label_ids?: string[]
  project_id?: string | null
  cycle_id?: string | null
  parent_id?: string | null
  estimate?: number | null
  due_date?: string | null
  /** Default: after the team's last issue. */
  sort_order?: number
}

/** PATCH /issues/{id}: only the sent keys change. `null` clears a nullable field. */
export interface UpdateIssueData {
  title?: string
  description?: string | null
  state_id?: string
  priority?: IssuePriority
  assignee_id?: string | null
  /** Replaces the labels. */
  label_ids?: string[]
  project_id?: string | null
  cycle_id?: string | null
  parent_id?: string | null
  estimate?: number | null
  due_date?: string | null
  sort_order?: number
  /** true archives (sets archived_at), false restores. */
  archived?: boolean
}

export type IssueOrderBy =
  | 'sort_order'
  | '-sort_order'
  | 'priority'
  | '-priority'
  | 'created_at'
  | '-created_at'
  | 'updated_at'
  | '-updated_at'
  | 'due_date'
  | '-due_date'
  | 'title'
  | '-title'
  | 'number'
  | '-number'

/** Query of GET /issues. Array values are sent comma-separated. */
export interface IssuesParams {
  workspace_id: string
  page?: number
  size?: number
  team_id?: string
  state_id__in?: string[]
  state_type__in?: WorkflowStateType[]
  priority__in?: IssuePriority[]
  /** A user id, "me" or "none" (unassigned). */
  assignee_id?: string
  /** A user id or "me". */
  creator_id?: string
  /** A user id or "me". */
  subscriber_id?: string
  label_id?: string
  /** Any of these: user ids, "me", "none". */
  assignee_id__in?: string[]
  /** Any of these: user ids, "me". */
  creator_id__in?: string[]
  /** Issues with any of these labels. */
  label_id__in?: string[]
  /** Any of these project ids; "none" = no project. */
  project_id__in?: string[]
  /** Any of these cycle ids; "none" = no cycle. */
  cycle_id__in?: string[]
  project_id?: string
  cycle_id?: string
  parent_id?: string
  /** true: only top-level issues; false: only sub-issues. */
  parent_id__isnull?: boolean
  include_archived?: boolean
  /** Title or description (case-insensitive), or the number ("12", "ENG-12"). */
  search?: string
  order_by?: IssueOrderBy[]
}

/** POST /issues/bulk-update: the same changes for every issue, all or nothing. */
export interface BulkUpdateIssuesData {
  issue_ids: string[]
  update: Pick<
    UpdateIssueData,
    'state_id' | 'priority' | 'assignee_id' | 'label_ids' | 'project_id' | 'cycle_id' | 'archived'
  > & {
    /** Labels to add (the others stay). */
    label_ids_add?: string[]
    /** Labels to remove (the others stay). */
    label_ids_remove?: string[]
  }
}

export interface BulkUpdateIssuesResponse {
  items: Issue[]
}

/** POST /issues/bulk-delete. */
export interface BulkDeleteIssuesData {
  issue_ids: string[]
}

/** Detail of the `linear:create-issue` window event: defaults of the create-issue modal. */
export interface CreateIssueEventDetail {
  teamId?: string
  /** The title typed so far (e.g. in the inline sub-issue input). */
  title?: string
  stateId?: string
  /** Without `stateId`: the team's first state of this type (Backlog tab: `backlog`). */
  stateType?: WorkflowStateType
  priority?: IssuePriority
  projectId?: string
  cycleId?: string
  parentId?: string
  assigneeId?: string
}

export type IssueRelationType = 'blocks' | 'related' | 'duplicate'

/** Planned: GET /issues/{id}/relations. `outgoing`: this issue <type> `issue`; `incoming`: `issue` <type> this issue. */
export interface IssueRelation {
  id: string
  type: IssueRelationType
  direction: 'outgoing' | 'incoming'
  issue: IssueRef
  created_at: string
}

export interface CreateIssueRelationData {
  related_issue_id: string
  /** `blocked_by` is stored as the other issue `blocks` this one. */
  type: IssueRelationType | 'blocked_by'
}

export type IssueActivityAction = 'created' | 'updated' | 'commented' | 'archived' | 'unarchived'

/** Planned: GET /issues/{id}/activity. */
export interface IssueActivity {
  id: string
  issue_id: string
  actor_id: string | null
  actor: UserSummary | null
  action: IssueActivityAction
  /** For "updated": title, description, state, priority, assignee, labels, project, cycle, parent, estimate, due_date. */
  field: string | null
  from_value: string | null
  to_value: string | null
  created_at: string
}

/** GET /issues/{id}/sub-issues: the sub-issues (not archived) and the progress counts. */
export interface SubIssues {
  items: Issue[]
  total: number
  /** Sub-issues in a "completed" state. */
  completed: number
}

/** POST /issues/{id}/subscribers. Default: the current user. */
export interface SubscribeData {
  user_id?: string
}
