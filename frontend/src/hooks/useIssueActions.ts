import { useMemo } from 'react'
import { toast } from 'sonner'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import {
  useBulkDeleteIssues,
  useBulkUpdateIssues,
  useUpdateIssue,
  useWorkspaceStates,
} from '@/hooks/useIssues'
import { toastApiError } from '@/lib/error-handler'
import type { BulkUpdateIssuesData, Issue, IssuePriority } from '@/types/issue'
import type { LabelSummary } from '@/types/label'
import type { WorkflowState } from '@/types/team'
import type { UserSummary } from '@/types/user'

export type IssueChanges = BulkUpdateIssuesData['update'] & { sort_order?: number }

/**
 * Property changes for one or many issues, with optimistic cache updates:
 * one issue = PATCH /issues/{id}; many = POST /issues/bulk-update. Status
 * changes on issues of several teams are sent per team (a state belongs to
 * one team), mapped to the team's state with the same name (or type).
 */
export function useIssueActions() {
  const { teams, members, labels } = useCurrentWorkspace()
  const { data: states } = useWorkspaceStates(teams)
  const update = useUpdateIssue()
  const bulk = useBulkUpdateIssues()
  const bulkDelete = useBulkDeleteIssues()

  return useMemo(() => {
    const userSummary = (userId: string | null | undefined): UserSummary | null => {
      const member = members.find(m => m.user_id === userId)
      return member ? member.user : null
    }

    const optimistic = (issue: Issue, changes: IssueChanges): Issue => {
      const next: Issue = { ...issue }
      if (changes.state_id !== undefined) {
        const state = states.find(s => s.id === changes.state_id)
        if (state) {
          next.state_id = state.id
          next.state = { id: state.id, name: state.name, type: state.type, color: state.color }
        }
      }
      if (changes.priority !== undefined) next.priority = changes.priority
      if (changes.assignee_id !== undefined) {
        next.assignee_id = changes.assignee_id
        next.assignee = userSummary(changes.assignee_id)
      }
      if (changes.project_id !== undefined) next.project_id = changes.project_id
      if (changes.cycle_id !== undefined) next.cycle_id = changes.cycle_id
      if (changes.sort_order !== undefined) next.sort_order = changes.sort_order
      const labelIds = new Set(changes.label_ids ?? issue.labels.map(l => l.id))
      changes.label_ids_add?.forEach(id => labelIds.add(id))
      changes.label_ids_remove?.forEach(id => labelIds.delete(id))
      if (changes.label_ids || changes.label_ids_add || changes.label_ids_remove) {
        next.labels = labels
          .filter(l => labelIds.has(l.id))
          .map<LabelSummary>(l => ({ id: l.id, name: l.name, color: l.color }))
      }
      return next
    }

    const apply = (issues: Issue[], changes: IssueChanges, what = 'Could not update issue') => {
      if (issues.length === 0) return
      const { label_ids_add, label_ids_remove, sort_order, ...rest } = changes
      if (issues.length === 1 && !label_ids_add && !label_ids_remove) {
        const issue = issues[0]
        const preview = optimistic(issue, changes)
        update.mutate(
          {
            id: issue.id,
            data: sort_order === undefined ? rest : { ...rest, sort_order },
            optimistic: preview,
          },
          { onError: error => toastApiError(error, what) }
        )
        return
      }
      bulk.mutate(
        {
          data: {
            issue_ids: issues.map(i => i.id),
            update: { ...rest, label_ids_add, label_ids_remove },
          },
          optimistic: issue => optimistic(issue, changes),
        },
        { onError: error => toastApiError(error, 'Could not update issues') }
      )
    }

    /** The state of `teamId` that matches `state` (same id, else same name, else same type). */
    const equivalentState = (state: WorkflowState, teamId: string): WorkflowState | undefined => {
      if (state.team_id === teamId) return state
      const teamStates = states.filter(s => s.team_id === teamId)
      return (
        teamStates.find(s => s.name.toLowerCase() === state.name.toLowerCase()) ??
        teamStates.find(s => s.type === state.type)
      )
    }

    const setState = (issues: Issue[], stateId: string, extra: IssueChanges = {}) => {
      const state = states.find(s => s.id === stateId)
      if (!state) return
      const byTeam = new Map<string, Issue[]>()
      for (const issue of issues)
        byTeam.set(issue.team_id, [...(byTeam.get(issue.team_id) ?? []), issue])
      for (const [teamId, teamIssues] of byTeam) {
        const target = equivalentState(state, teamId)
        if (target) apply(teamIssues, { ...extra, state_id: target.id })
      }
    }

    const deleteIssues = (issues: Issue[], onDone?: () => void) => {
      if (issues.length === 0) return
      bulkDelete.mutate(
        { issue_ids: issues.map(i => i.id) },
        {
          onSuccess: () => {
            toast.success(
              issues.length === 1
                ? `Deleted ${issues[0].identifier}`
                : `Deleted ${issues.length} issues`
            )
            onDone?.()
          },
          onError: error => toastApiError(error, 'Could not delete issues'),
        }
      )
    }

    return {
      states,
      apply,
      setState,
      equivalentState,
      setPriority: (issues: Issue[], priority: IssuePriority) => apply(issues, { priority }),
      setAssignee: (issues: Issue[], assigneeId: string | null) =>
        apply(issues, { assignee_id: assigneeId }),
      setLabels: (issue: Issue, labelIds: string[]) => apply([issue], { label_ids: labelIds }),
      addLabels: (issues: Issue[], labelIds: string[]) =>
        apply(issues, { label_ids_add: labelIds }),
      removeLabels: (issues: Issue[], labelIds: string[]) =>
        apply(issues, { label_ids_remove: labelIds }),
      setProject: (issues: Issue[], projectId: string | null) =>
        apply(issues, { project_id: projectId }),
      deleteIssues,
      isDeleting: bulkDelete.isPending,
    }
  }, [members, labels, states, update, bulk, bulkDelete])
}

export type IssueActions = ReturnType<typeof useIssueActions>
