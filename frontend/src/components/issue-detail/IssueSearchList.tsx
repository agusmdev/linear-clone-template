import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { StatusIcon } from '@/components/StatusIcon'
import type { IssueRef } from '@/types/issue'

interface IssueSearchListProps {
  /** Heading of the result list, e.g. "Blocked by". */
  label: string
  search: string
  onSearchChange: (search: string) => void
  /** Issues matching `search` (the page runs the query: server-side search). */
  results: IssueRef[]
  loading?: boolean
  onSelect: (issue: IssueRef) => void
}

/** Searchable issue list for a popover: search box + results (identifier, status, title). */
export function IssueSearchList({
  label,
  search,
  onSearchChange,
  results,
  loading,
  onSelect,
}: IssueSearchListProps) {
  return (
    <Command shouldFilter={false} label={label} loop>
      <CommandInput
        // The list opens for typing: focus the search box.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        placeholder="Search issues..."
        value={search}
        onValueChange={onSearchChange}
      />
      <CommandList>
        <CommandEmpty>{loading ? 'Searching...' : 'No issues found'}</CommandEmpty>
        {results.length > 0 ? (
          <CommandGroup heading={label}>
            {results.map(issue => (
              <CommandItem key={issue.id} value={issue.id} onSelect={() => onSelect(issue)}>
                <StatusIcon type={issue.state.type} color={issue.state.color} />
                <span className="min-w-14 shrink-0 text-mini whitespace-nowrap text-text-tertiary">
                  {issue.identifier}
                </span>
                <span className="truncate">{issue.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  )
}
