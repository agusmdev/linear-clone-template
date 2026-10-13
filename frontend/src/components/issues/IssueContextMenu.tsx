import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  CircleDot,
  Copy,
  ExternalLink,
  Link2,
  SignalHigh,
  Tag,
  Trash2,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { PriorityIcon, PRIORITY_LABELS } from '@/components/PriorityIcon'
import { UserAvatar } from '@/components/UserAvatar'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { Issue } from '@/types/issue'
import { LabelDot, memberName, PRIORITY_MENU, StateIcon } from './issue-options'
import { useIssueView } from './IssuePickers'

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied`)
  } catch {
    toast.error(`Could not copy ${what.toLowerCase()}`)
  }
}

/** Right-click menu of an issue row or card. Acts on the selection when the issue is selected. */
export function IssueContextMenu({ issue, children }: { issue: Issue; children: ReactNode }) {
  const view = useIssueView()
  const navigate = useNavigate()
  const targets = view.targetsFor(issue)
  const many = targets.length > 1
  const teamIds = new Set(targets.map(t => t.team_id))
  // Status options: the states of the issue's team (mapped per team when many teams).
  const states = view.states
    .filter(s => s.team_id === issue.team_id)
    .sort((a, b) => a.position - b.position)
  const issuePath = view.path(`/issue/${issue.identifier}`)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent
        className="w-56"
        onClick={event => event.stopPropagation()}
        onPointerDown={event => event.stopPropagation()}
        onKeyDown={event => event.stopPropagation()}
      >
        {many ? (
          <div className="px-2 py-1 text-mini text-text-tertiary">{targets.length} issues</div>
        ) : null}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <CircleDot />
            Status
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {states.map(state => (
              <ContextMenuCheckboxItem
                key={state.id}
                checked={!many && issue.state_id === state.id}
                onSelect={() => view.actions.setState(targets, state.id)}
              >
                <StateIcon state={state} teamStates={states} />
                {state.name}
                {teamIds.size > 1 ? <ContextMenuShortcut>all teams</ContextMenuShortcut> : null}
              </ContextMenuCheckboxItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <SignalHigh />
            Priority
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44">
            {PRIORITY_MENU.map(priority => (
              <ContextMenuCheckboxItem
                key={priority}
                checked={!many && issue.priority === priority}
                onSelect={() => view.actions.setPriority(targets, priority)}
              >
                <PriorityIcon priority={priority} />
                {PRIORITY_LABELS[priority]}
              </ContextMenuCheckboxItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <UserRound />
            Assignee
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="max-h-72 w-52 overflow-y-auto">
            <ContextMenuCheckboxItem
              checked={!many && issue.assignee_id === null}
              onSelect={() => view.actions.setAssignee(targets, null)}
            >
              <UserAvatar name={null} size="xs" />
              No assignee
            </ContextMenuCheckboxItem>
            {view.members.map(member => (
              <ContextMenuCheckboxItem
                key={member.user_id}
                checked={!many && issue.assignee_id === member.user_id}
                onSelect={() => view.actions.setAssignee(targets, member.user_id)}
              >
                <UserAvatar name={memberName(member)} size="xs" />
                {memberName(member)}
              </ContextMenuCheckboxItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Tag />
            Labels
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="max-h-72 w-48 overflow-y-auto">
            {view.labels.map(label => {
              const onAll = targets.every(t => t.labels.some(l => l.id === label.id))
              return (
                <ContextMenuCheckboxItem
                  key={label.id}
                  checked={onAll}
                  onSelect={event => {
                    event.preventDefault()
                    if (onAll) view.actions.removeLabels(targets, [label.id])
                    else view.actions.addLabels(targets, [label.id])
                  }}
                >
                  <LabelDot color={label.color} />
                  {label.name}
                </ContextMenuCheckboxItem>
              )
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        {!many ? (
          <>
            <ContextMenuItem onSelect={() => void navigate({ to: issuePath as '/' })}>
              <ExternalLink />
              Open issue
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => void copy(issue.identifier, 'ID')}>
              <Copy />
              Copy ID
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => void copy(`${window.location.origin}${issuePath}`, 'Link')}
            >
              <Link2 />
              Copy link
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        ) : null}
        <ContextMenuItem variant="destructive" onSelect={() => view.confirmDelete(targets)}>
          <Trash2 />
          {many ? `Delete ${targets.length} issues…` : 'Delete issue…'}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
