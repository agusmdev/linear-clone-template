import * as React from 'react'
import { Check } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Kbd } from '@/components/Kbd'
import { cn } from '@/lib/utils'

export interface PropertyOption<V extends string = string> {
  /** Stable id (state id, user id, "1" for a priority...). */
  value: V
  /** Text shown and searched. */
  label: string
  /** Leading icon: <StatusIcon />, <PriorityIcon />, <UserAvatar size="xs" />, a color dot... */
  icon?: React.ReactNode
  /** Extra search words (e.g. email, team key). */
  keywords?: string[]
  /** One key that picks this option while the search box is empty, e.g. "1". */
  shortcut?: string
  /** Options with the same group are shown under one heading, in first-seen order. */
  group?: string
  disabled?: boolean
}

interface PropertyPickerBaseProps<V extends string> {
  options: PropertyOption<V>[]
  /** The element that opens the picker (a button). Rendered with PopoverTrigger asChild. */
  trigger: React.ReactNode
  /** Placeholder of the search input, e.g. "Change status...". */
  placeholder?: string
  /** Shown when the search finds nothing. */
  emptyText?: string
  /** Accessible name of the option list, e.g. "Status". */
  label?: string
  /** Controlled open state (for keyboard shortcuts like S / P / A). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Width class of the popover. Default 'w-64'. */
  contentClassName?: string
  /** Extra rows under the list, e.g. a "Create label" CommandItem. */
  footer?: React.ReactNode
  /** Runs when the picker closes, before focus goes back to the trigger. Call
   * `event.preventDefault()` to put focus somewhere else (e.g. an issue list). */
  onCloseAutoFocus?: (event: Event) => void
  /** Called with the search text (and '' on close), e.g. to load options from the server. */
  onSearchChange?: (search: string) => void
}

interface SingleProps<V extends string> extends PropertyPickerBaseProps<V> {
  multiple?: false
  value: V | null
  onChange: (value: V) => void
}

interface MultiProps<V extends string> extends PropertyPickerBaseProps<V> {
  multiple: true
  value: V[]
  onChange: (value: V[]) => void
}

export type PropertyPickerProps<V extends string = string> = SingleProps<V> | MultiProps<V>

/**
 * Case-insensitive search on the label and keywords, like Linear's menus: every
 * word of the search is in one of them, in any order ("login safari" finds
 * "Login page crashes on Safari", as the server search of the parent picker does).
 */
function filterOption(_value: string, search: string, keywords?: string[]): number {
  const needles = search.toLowerCase().split(/\s+/).filter(Boolean)
  const haystacks = (keywords ?? []).map(word => word.toLowerCase())
  return needles.every(needle => haystacks.some(text => text.includes(needle))) ? 1 : 0
}

function groupOptions<V extends string>(options: PropertyOption<V>[]) {
  const groups = new Map<string, PropertyOption<V>[]>()
  for (const option of options) {
    const key = option.group ?? ''
    groups.set(key, [...(groups.get(key) ?? []), option])
  }
  return [...groups.entries()]
}

/**
 * Searchable popover combobox for an issue property (status, priority, assignee,
 * labels, project...). Arrow keys move, Enter picks, Esc closes.
 * Single select closes on pick; multi select (`multiple`) toggles and stays open.
 */
export function PropertyPicker<V extends string = string>(props: PropertyPickerProps<V>) {
  const {
    options,
    trigger,
    placeholder = 'Search...',
    emptyText = 'No results',
    label,
    align = 'start',
    side,
    contentClassName,
    footer,
    onCloseAutoFocus,
    onSearchChange,
  } = props
  const [innerOpen, setInnerOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const open = props.open ?? innerOpen

  const changeSearch = (next: string) => {
    setSearch(next)
    onSearchChange?.(next)
  }

  const setOpen = (next: boolean) => {
    if (props.open === undefined) setInnerOpen(next)
    props.onOpenChange?.(next)
    if (!next) changeSearch('')
  }

  const isSelected = (value: V) =>
    props.multiple ? props.value.includes(value) : props.value === value

  const pick = (option: PropertyOption<V>) => {
    if (option.disabled) return
    if (props.multiple) {
      const next = props.value.includes(option.value)
        ? props.value.filter(v => v !== option.value)
        : [...props.value, option.value]
      props.onChange(next)
    } else {
      props.onChange(option.value)
      setOpen(false)
    }
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (search !== '' || event.metaKey || event.ctrlKey || event.altKey) return
    const option = options.find(o => o.shortcut && o.shortcut === event.key)
    if (!option) return
    event.preventDefault()
    pick(option)
  }

  const groups = groupOptions(options)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className={cn('w-64 p-0', contentClassName)}
        onKeyDown={onKeyDown}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <Command
          filter={filterOption}
          label={label}
          loop
          // Cmd/Ctrl+Enter submits the form around the picker (e.g. "Create issue"):
          // cmdk must not also pick the highlighted option (that toggled off a label
          // just added, or changed the value the chip shows right before the submit).
          onKeyDown={event => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) event.preventDefault()
          }}
        >
          <CommandInput placeholder={placeholder} value={search} onValueChange={changeSearch} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups.map(([group, groupOpts]) => (
              <CommandGroup key={group || '_'} heading={group || undefined}>
                {groupOpts.map(option => {
                  const selected = isSelected(option.value)
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      keywords={[option.label, ...(option.keywords ?? [])]}
                      disabled={option.disabled}
                      onSelect={() => pick(option)}
                      data-checked={selected ? 'true' : undefined}
                    >
                      {props.multiple ? (
                        <Checkbox
                          checked={selected}
                          tabIndex={-1}
                          aria-hidden
                          className="pointer-events-none"
                        />
                      ) : null}
                      {option.icon ? (
                        <span className="flex size-4 items-center justify-center">
                          {option.icon}
                        </span>
                      ) : null}
                      <span className="truncate">{option.label}</span>
                      <span className="ml-auto flex items-center gap-2">
                        {!props.multiple && selected ? (
                          <Check className="size-4 text-foreground" aria-label="Selected" />
                        ) : null}
                        {option.shortcut ? <Kbd>{option.shortcut}</Kbd> : null}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
            {footer ? (
              <>
                <CommandSeparator />
                <CommandGroup>{footer}</CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
