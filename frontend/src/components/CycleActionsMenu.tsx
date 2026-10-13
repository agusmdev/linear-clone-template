import { ArrowRightLeft, Ellipsis, Pencil, Trash2 } from 'lucide-react'
import { IconButton } from '@/components/IconButton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface CycleActionsMenuProps {
  /** Accessible name of the trigger, e.g. "Cycle 3 actions". */
  label: string
  onEdit: () => void
  onDelete: () => void
  /** Shown only when given: move the unfinished issues to the next cycle. */
  onComplete?: () => void
  size?: 'sm' | 'md'
  className?: string
}

/** The "..." menu of a cycle: Edit, (Move unfinished issues), Delete. */
export function CycleActionsMenu({
  label,
  onEdit,
  onDelete,
  onComplete,
  size = 'md',
  className,
}: CycleActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={label} icon={<Ellipsis />} size={size} className={className} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil />
          Edit cycle
        </DropdownMenuItem>
        {onComplete ? (
          <DropdownMenuItem onSelect={onComplete}>
            <ArrowRightLeft />
            Move unfinished issues
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          Delete cycle
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
