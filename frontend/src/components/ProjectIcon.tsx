import {
  Book,
  Box,
  Bug,
  Code,
  Flag,
  Globe,
  Heart,
  Layers,
  Rocket,
  Star,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/** Icons a project can use (stored by name in `Project.icon`). */
export const PROJECT_ICONS: Record<string, LucideIcon> = {
  box: Box,
  rocket: Rocket,
  zap: Zap,
  target: Target,
  flag: Flag,
  layers: Layers,
  star: Star,
  heart: Heart,
  globe: Globe,
  code: Code,
  bug: Bug,
  book: Book,
}

/** Project colors (stored as hex in `Project.color`: user data, like label colors). */
export const PROJECT_COLORS = [
  '#5e6ad2',
  '#26b5ce',
  '#4cb782',
  '#f2c94c',
  '#f2994a',
  '#eb5757',
  '#bb87fc',
  '#95a2b3',
]

export const DEFAULT_PROJECT_ICON = 'box'
export const DEFAULT_PROJECT_COLOR = PROJECT_COLORS[0]

interface ProjectIconProps {
  icon: string | null
  color: string | null
  size?: number
  className?: string
}

/** The project's icon in its color (a box in the accent color by default). */
export function ProjectIcon({ icon, color, size = 14, className }: ProjectIconProps) {
  const Icon = PROJECT_ICONS[icon ?? ''] ?? Box
  return (
    <Icon
      aria-hidden
      className={cn('shrink-0', className)}
      style={{ width: size, height: size, color: color ?? DEFAULT_PROJECT_COLOR }}
    />
  )
}

interface ProjectIconPickerProps {
  icon: string | null
  color: string | null
  onChange: (value: { icon: string; color: string }) => void
  /** The trigger button content size. */
  size?: number
  className?: string
}

/** A button with the project icon; opens a grid of icons and colors. */
export function ProjectIconPicker({
  icon,
  color,
  onChange,
  size = 16,
  className,
}: ProjectIconPickerProps) {
  const currentIcon = icon ?? DEFAULT_PROJECT_ICON
  const currentColor = color ?? DEFAULT_PROJECT_COLOR
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Change project icon"
          className={cn(
            'inline-flex items-center justify-center rounded-md border border-border bg-surface-hover/40 hover:bg-surface-hover data-[state=open]:bg-surface-active',
            className
          )}
        >
          <ProjectIcon icon={icon} color={color} size={size} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div role="group" aria-label="Icon" className="grid grid-cols-6 gap-1">
          {Object.entries(PROJECT_ICONS).map(([name, Icon]) => (
            <button
              key={name}
              type="button"
              aria-label={`Icon ${name}`}
              aria-pressed={name === currentIcon}
              onClick={() => onChange({ icon: name, color: currentColor })}
              className={cn(
                'flex size-7 items-center justify-center rounded-md hover:bg-surface-hover',
                name === currentIcon && 'bg-surface-active'
              )}
            >
              <Icon className="size-4" style={{ color: currentColor }} />
            </button>
          ))}
        </div>
        <div className="my-2 h-px bg-border-subtle" />
        <div role="group" aria-label="Color" className="grid grid-cols-8 gap-1">
          {PROJECT_COLORS.map(value => (
            <button
              key={value}
              type="button"
              aria-label={`Color ${value}`}
              aria-pressed={value === currentColor}
              onClick={() => onChange({ icon: currentIcon, color: value })}
              className={cn(
                'flex size-5 items-center justify-center rounded-full ring-offset-2 ring-offset-popover',
                value === currentColor && 'ring-2 ring-foreground/60'
              )}
              style={{ backgroundColor: value }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
