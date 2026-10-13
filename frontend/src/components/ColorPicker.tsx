import * as React from 'react'
import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { COLOR_PALETTE, HEX_COLOR_PATTERN } from '@/features/workspaces/workspace-schemas'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
  /** Current color, `#rrggbb`. */
  value: string
  onChange: (color: string) => void
  /** Accessible name of the trigger, e.g. "Label color". */
  label: string
  /** Custom trigger (rendered with `asChild`). Default: a round swatch button. */
  trigger?: React.ReactNode
  disabled?: boolean
  align?: 'start' | 'center' | 'end'
}

/** Linear's color popover: a palette of swatches plus a hex field. */
export function ColorPicker({
  value,
  onChange,
  label,
  trigger,
  disabled,
  align = 'start',
}: ColorPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [hex, setHex] = React.useState(value)

  const handleOpenChange = (next: boolean) => {
    if (next) setHex(value)
    setOpen(next)
  }

  const pick = (color: string) => {
    onChange(color)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger ?? (
          <button
            type="button"
            aria-label={`${label}: ${value}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none disabled:opacity-50"
          >
            <span className="size-3.5 rounded-full" style={{ backgroundColor: value }} />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-56 p-2" aria-label={label}>
        <div role="listbox" aria-label={label} className="grid grid-cols-5 gap-1.5">
          {COLOR_PALETTE.map(color => {
            const selected = color.toLowerCase() === value.toLowerCase()
            return (
              <button
                key={color}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={color}
                onClick={() => pick(color)}
                className="flex size-8 items-center justify-center rounded-md hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
              >
                <span
                  className="flex size-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: color }}
                >
                  {selected ? <Check className="size-3 text-white" /> : null}
                </span>
              </button>
            )
          })}
        </div>
        <form
          className="mt-2 flex items-center gap-2 border-t border-border-subtle pt-2"
          onSubmit={event => {
            event.preventDefault()
            if (HEX_COLOR_PATTERN.test(hex)) pick(hex.toLowerCase())
          }}
        >
          <span
            aria-hidden
            className={cn('size-4 shrink-0 rounded-full border border-border')}
            style={{ backgroundColor: HEX_COLOR_PATTERN.test(hex) ? hex : 'transparent' }}
          />
          <Input
            aria-label="Hex color"
            value={hex}
            onChange={event => setHex(event.target.value.trim())}
            className="h-7 font-mono text-mini"
            maxLength={7}
          />
        </form>
      </PopoverContent>
    </Popover>
  )
}
