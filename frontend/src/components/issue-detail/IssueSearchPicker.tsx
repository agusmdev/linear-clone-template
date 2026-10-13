import * as React from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { StatusIcon } from '@/components/StatusIcon'
import type { IssueRef } from '@/types/issue'

interface IssueSearchPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The element the popover is placed next to. */
  anchor: React.ReactNode
  /** Heading of the result list, e.g. "Blocked by". */
  label: string
  search: string
  onSearchChange: (search: string) => void
  /** Issues matching `search` (the page runs the query). */
  results: IssueRef[]
  loading?: boolean
  onSelect: (issue: IssueRef) => void
}

/** Searchable issue list in a popover (server-side search: the page passes the results). */
export function IssueSearchPicker({
  open,
  onOpenChange,
  anchor,
  label,
  search,
  onSearchChange,
  results,
  loading,
  onSelect,
}: IssueSearchPickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{anchor}</PopoverAnchor>
      <PopoverContent align="end" className="w-80 p-0">
        <Command shouldFilter={false} label={label} loop>
          <CommandInput
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
                    <span className="w-14 shrink-0 text-mini text-text-tertiary">
                      {issue.identifier}
                    </span>
                    <span className="truncate">{issue.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
