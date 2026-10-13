import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Kbd } from '@/components/Kbd'
import { cn } from '@/lib/utils'

const iconButtonVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors duration-100 hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-surface-active data-[active=true]:text-foreground data-[state=open]:bg-surface-active data-[state=open]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      size: {
        sm: 'size-6 [&_svg]:size-3.5',
        md: 'size-7 [&_svg]:size-4',
        lg: 'size-8 [&_svg]:size-4',
      },
      variant: {
        ghost: '',
        outline: 'border border-border',
      },
    },
    defaultVariants: { size: 'md', variant: 'ghost' },
  }
)

type IconButtonProps = Omit<React.ComponentProps<'button'>, 'children'> &
  VariantProps<typeof iconButtonVariants> & {
    /** Accessible name; also the tooltip text. */
    label: string
    /** The icon element, e.g. <Plus />. */
    icon: React.ReactNode
    /** Shortcut shown in the tooltip, e.g. "C" or "⌘K". */
    shortcut?: string
    /** Pressed/selected look. */
    active?: boolean
    /** Set false to drop the tooltip. Default true. */
    tooltip?: boolean
    tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
  }

/**
 * Square icon-only button with an aria-label and a tooltip.
 * Works as a Radix trigger child: <DropdownMenuTrigger asChild><IconButton .../></DropdownMenuTrigger>.
 */
export function IconButton({
  label,
  icon,
  shortcut,
  active,
  tooltip = true,
  tooltipSide = 'bottom',
  size,
  variant,
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  const button = (
    <button
      type={type}
      aria-label={label}
      data-active={active ? 'true' : undefined}
      className={cn(iconButtonVariants({ size, variant }), className)}
      {...props}
    >
      {icon}
    </button>
  )
  if (!tooltip) return button
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side={tooltipSide}>
        {label}
        {shortcut ? <Kbd>{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  )
}
