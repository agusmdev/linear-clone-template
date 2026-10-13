import { useEffect, useState, type ReactNode } from 'react'
import {
  CircleDot,
  Columns3,
  Hexagon,
  ListFilter,
  RefreshCcw,
  Rows3,
  Search,
  SignalHigh,
  SlidersHorizontal,
  Tag,
  UserRound,
  UserRoundPen,
  X,
} from 'lucide-react'
import { PropertyPicker, type PropertyOption } from '@/components/PropertyPicker'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  FILTER_KINDS,
  FILTER_LABELS,
  GROUPING_LABELS,
  ORDERING_LABELS,
  type FilterKind,
  type IssueGrouping,
  type IssueOrdering,
  type IssueViewState,
} from '@/features/issues/view-state'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'

const FILTER_ICONS: Record<FilterKind, ReactNode> = {
  status: <CircleDot />,
  priority: <SignalHigh />,
  assignee: <UserRound />,
  creator: <UserRoundPen />,
  label: <Tag />,
  project: <Hexagon />,
  cycle: <RefreshCcw />,
}

interface IssueToolbarProps {
  state: IssueViewState
  onChange: (next: IssueViewState) => void
  /** Picker options per filter kind. A kind with no options is not offered. */
  filterOptions: Record<FilterKind, PropertyOption[]>
  /** The default view state (for "Reset"). */
  defaults: IssueViewState
  /** Extra buttons on the right (e.g. "New issue"). */
  actions?: ReactNode
}

/** Filter chips + "Filter" menu, search box and the "Display" options popover. */
export function IssueToolbar({
  state,
  onChange,
  filterOptions,
  defaults,
  actions,
}: IssueToolbarProps) {
  const [openKind, setOpenKind] = useState<FilterKind | null>(null)
  const shownKinds = FILTER_KINDS.filter(
    kind => state.filters[kind].length > 0 || openKind === kind
  )
  const offered = FILTER_KINDS.filter(kind => filterOptions[kind].length > 0)

  const setFilter = (kind: FilterKind, values: string[]) =>
    onChange({ ...state, filters: { ...state.filters, [kind]: values } })

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 border-b border-border-subtle px-4 py-1.5">
      {shownKinds.map(kind => (
        <FilterChip
          key={kind}
          kind={kind}
          values={state.filters[kind]}
          options={filterOptions[kind]}
          open={openKind === kind}
          onOpenChange={open => setOpenKind(open ? kind : null)}
          onChange={values => setFilter(kind, values)}
          onClear={() => {
            setOpenKind(null)
            setFilter(kind, [])
          }}
        />
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-text-secondary">
            <ListFilter className="size-3.5" />
            Filter
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-48"
          onCloseAutoFocus={e => e.preventDefault()}
        >
          {offered.map(kind => (
            <DropdownMenuItem key={kind} onSelect={() => setOpenKind(kind)}>
              {FILTER_ICONS[kind]}
              {FILTER_LABELS[kind]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {shownKinds.length > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-text-tertiary"
          onClick={() => onChange({ ...state, filters: defaults.filters })}
        >
          Clear filters
        </Button>
      ) : null}
      <div className="ml-auto flex items-center gap-1.5">
        <SearchBox value={state.search} onChange={search => onChange({ ...state, search })} />
        <DisplayOptions state={state} onChange={onChange} defaults={defaults} />
        {actions}
      </div>
    </div>
  )
}

interface FilterChipProps {
  kind: FilterKind
  values: string[]
  options: PropertyOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange: (values: string[]) => void
  onClear: () => void
}

function FilterChip({
  kind,
  values,
  options,
  open,
  onOpenChange,
  onChange,
  onClear,
}: FilterChipProps) {
  const picked = options.filter(o => values.includes(o.value))
  const summary =
    picked.length === 0
      ? 'any'
      : picked.length <= 2
        ? picked.map(o => o.label).join(', ')
        : `${picked.length} values`
  const verb = picked.length > 1 ? 'is any of' : 'is'
  return (
    <div
      role="group"
      aria-label={`${FILTER_LABELS[kind]} filter`}
      className="flex h-7 items-center overflow-hidden rounded-md border border-border text-mini"
    >
      <span className="flex h-full items-center gap-1.5 border-r border-border px-2 text-text-secondary [&_svg]:size-3.5">
        {FILTER_ICONS[kind]}
        {FILTER_LABELS[kind]}
      </span>
      <span className="flex h-full items-center border-r border-border px-2 text-text-tertiary">
        {verb}
      </span>
      <PropertyPicker
        multiple
        open={open}
        onOpenChange={onOpenChange}
        label={FILTER_LABELS[kind]}
        placeholder={`Filter by ${FILTER_LABELS[kind].toLowerCase()}...`}
        options={options}
        value={values}
        onChange={onChange}
        trigger={
          <button
            type="button"
            className="flex h-full max-w-56 items-center gap-1.5 truncate border-r border-border px-2 text-foreground hover:bg-surface-hover data-[state=open]:bg-surface-active"
          >
            {picked.slice(0, 3).map(o =>
              o.icon ? (
                <span key={o.value} className="flex size-3.5 items-center justify-center">
                  {o.icon}
                </span>
              ) : null
            )}
            <span className="truncate">{summary}</span>
          </button>
        }
      />
      <button
        type="button"
        aria-label={`Remove ${FILTER_LABELS[kind].toLowerCase()} filter`}
        onClick={onClear}
        className="flex h-full items-center px-1.5 text-text-tertiary hover:bg-surface-hover hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value)
  const debounced = useDebounce(text, 250)

  useEffect(() => {
    if (debounced !== value) onChange(debounced)
    // Only the debounced text drives the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  return (
    <label className="flex h-7 w-40 items-center gap-1.5 rounded-md border border-border bg-input px-2 text-mini focus-within:ring-2 focus-within:ring-ring/60 sm:w-52">
      <Search className="size-3.5 shrink-0 text-text-tertiary" aria-hidden />
      <input
        type="search"
        aria-label="Search issues"
        placeholder="Search issues..."
        value={text}
        onChange={event => setText(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Escape') setText('')
        }}
        className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-text-tertiary"
      />
    </label>
  )
}

interface DisplayOptionsProps {
  state: IssueViewState
  onChange: (next: IssueViewState) => void
  defaults: IssueViewState
}

function DisplayOptions({ state, onChange, defaults }: DisplayOptionsProps) {
  const layoutButton = (layout: 'list' | 'board', icon: ReactNode, text: string) => (
    <button
      type="button"
      aria-pressed={state.layout === layout}
      onClick={() => onChange({ ...state, layout })}
      className={cn(
        'flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-md border border-border text-mini text-text-secondary hover:bg-surface-hover [&_svg]:size-4',
        state.layout === layout && 'border-primary/60 bg-surface-active text-foreground'
      )}
    >
      {icon}
      {text}
    </button>
  )
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2">
          <SlidersHorizontal className="size-3.5" />
          Display
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3" aria-label="Display options">
        <div className="flex gap-2">
          {layoutButton('list', <Rows3 />, 'List')}
          {layoutButton('board', <Columns3 />, 'Board')}
        </div>
        <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-mini">
          <Label htmlFor="issue-grouping" className="text-text-secondary">
            Grouping
          </Label>
          <Select
            value={state.grouping}
            onValueChange={value => onChange({ ...state, grouping: value as IssueGrouping })}
          >
            <SelectTrigger id="issue-grouping" aria-label="Grouping" className="h-7 text-mini">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(GROUPING_LABELS) as IssueGrouping[]).map(grouping => (
                <SelectItem key={grouping} value={grouping}>
                  {GROUPING_LABELS[grouping]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label htmlFor="issue-ordering" className="text-text-secondary">
            Ordering
          </Label>
          <Select
            value={state.ordering}
            onValueChange={value => onChange({ ...state, ordering: value as IssueOrdering })}
          >
            <SelectTrigger id="issue-ordering" aria-label="Ordering" className="h-7 text-mini">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ORDERING_LABELS) as IssueOrdering[]).map(ordering => (
                <SelectItem key={ordering} value={ordering}>
                  {ORDERING_LABELS[ordering]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex flex-col gap-2 border-t border-border-subtle pt-3 text-mini">
          <div className="flex items-center justify-between text-text-secondary">
            <span aria-hidden>Show sub-issues</span>
            <Switch
              aria-label="Show sub-issues"
              checked={state.showSubIssues}
              onCheckedChange={checked => onChange({ ...state, showSubIssues: checked })}
            />
          </div>
          <div className="flex items-center justify-between text-text-secondary">
            <span aria-hidden>Show completed issues</span>
            <Switch
              aria-label="Show completed issues"
              checked={state.showCompleted}
              onCheckedChange={checked => onChange({ ...state, showCompleted: checked })}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end border-t border-border-subtle pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-text-secondary"
            onClick={() => onChange({ ...defaults, filters: state.filters, search: state.search })}
          >
            Reset to default
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
