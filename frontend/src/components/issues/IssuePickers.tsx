import { createContext, useContext, type ReactNode } from 'react'
import { PropertyPicker } from '@/components/PropertyPicker'
import type { IssueActions } from '@/hooks/useIssueActions'
import type { NamedRef } from '@/hooks/useIssueRefs'
import type { Issue, IssuePriority } from '@/types/issue'
import type { Label } from '@/types/label'
import type { Team, WorkflowState } from '@/types/team'
import type { WorkspaceMember } from '@/types/workspace'
import {
  assigneeOptions,
  labelOptions,
  NONE,
  priorityOptions,
  statusOptions,
} from './issue-options'

export type PickerKind = 'status' | 'priority' | 'assignee' | 'labels'

export interface OpenPicker {
  issueId: string
  kind: PickerKind
}

/** What rows, cards and menus of one IssuesView share. */
export interface IssueViewContextValue {
  teams: Team[]
  /** States of every team of the workspace. */
  states: WorkflowState[]
  members: WorkspaceMember[]
  labels: Label[]
  projects: NamedRef[]
  meId: string
  actions: IssueActions
  openPicker: OpenPicker | null
  setOpenPicker: (picker: OpenPicker | null) => void
  /**
   * Runs when a row picker closes. In the list layout it puts focus back on the
   * issue listbox (so J/K/S/P/A/Enter keep working), not on the row's trigger.
   */
  onPickerCloseAutoFocus: (event: Event) => void
  /** The issues a menu action applies to: the selection if `issue` is in it, else `issue`. */
  targetsFor: (issue: Issue) => Issue[]
  /** Opens the delete confirmation for these issues. */
  confirmDelete: (issues: Issue[]) => void
  /** Workspace path builder (`/acme/...`). */
  path: (subPath: string) => string
}

export const IssueViewContext = createContext<IssueViewContextValue | null>(null)

export function useIssueView(): IssueViewContextValue {
  const value = useContext(IssueViewContext)
  if (!value) throw new Error('useIssueView must be used inside IssuesView')
  return value
}

/**
 * Stops clicks, pointer and key events from reaching the row: a picker in a row
 * must not open the issue (React events bubble through portals too).
 */
export function StopRowEvents({ children }: { children: ReactNode }) {
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <span
      className="contents"
      onClick={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
      onContextMenu={event => event.stopPropagation()}
    >
      {children}
    </span>
  )
}

interface IssuePickerProps {
  issue: Issue
  kind: PickerKind
  trigger: ReactNode
  align?: 'start' | 'center' | 'end'
}

/**
 * The inline status / priority / assignee / labels picker of one issue (controlled by the view).
 * When the issue is part of a multi-selection, the change applies to every selected issue
 * (S / P / A / L on a selection, like Linear).
 */
export function IssuePicker({ issue, kind, trigger, align = 'start' }: IssuePickerProps) {
  const view = useIssueView()
  const targets = view.targetsFor(issue)
  const many = targets.length > 1
  const open = view.openPicker?.issueId === issue.id && view.openPicker.kind === kind
  const onOpenChange = (next: boolean) =>
    view.setOpenPicker(next ? { issueId: issue.id, kind } : null)
  const common = {
    open,
    onOpenChange,
    trigger,
    align,
    onCloseAutoFocus: view.onPickerCloseAutoFocus,
  }

  let picker: ReactNode
  if (kind === 'status') {
    const teamStates = view.states.filter(s => s.team_id === issue.team_id)
    picker = (
      <PropertyPicker
        {...common}
        label="Status"
        placeholder="Change status..."
        options={statusOptions(teamStates)}
        value={many ? null : issue.state_id}
        onChange={stateId => view.actions.setState(targets, stateId)}
      />
    )
  } else if (kind === 'priority') {
    picker = (
      <PropertyPicker
        {...common}
        label="Priority"
        placeholder="Set priority to..."
        options={priorityOptions()}
        value={many ? null : String(issue.priority)}
        onChange={value => view.actions.setPriority(targets, Number(value) as IssuePriority)}
      />
    )
  } else if (kind === 'assignee') {
    picker = (
      <PropertyPicker
        {...common}
        label="Assignee"
        placeholder="Assign to..."
        options={assigneeOptions(view.members, { meId: view.meId })}
        value={many ? null : (issue.assignee_id ?? NONE)}
        onChange={value => view.actions.setAssignee(targets, value === NONE ? null : value)}
      />
    )
  } else {
    // Many issues: the checked labels are the ones every selected issue has;
    // a toggle adds or removes that label on all of them.
    const shared = view.labels
      .filter(label => targets.every(t => t.labels.some(l => l.id === label.id)))
      .map(label => label.id)
    picker = (
      <PropertyPicker
        {...common}
        multiple
        label="Labels"
        placeholder="Change labels..."
        options={labelOptions(view.labels)}
        value={many ? shared : issue.labels.map(l => l.id)}
        onChange={labelIds => {
          if (!many) {
            view.actions.setLabels(issue, labelIds)
            return
          }
          const added = labelIds.filter(id => !shared.includes(id))
          const removed = shared.filter(id => !labelIds.includes(id))
          if (added.length) view.actions.addLabels(targets, added)
          if (removed.length) view.actions.removeLabels(targets, removed)
        }}
      />
    )
  }
  return <StopRowEvents>{picker}</StopRowEvents>
}
