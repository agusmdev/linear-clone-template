import { useState, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'

/** The emojis offered for a document icon. */
export const DOCUMENT_EMOJIS: readonly string[] = [
  '📄 📝 📘 📙 📗 📕 📓 📚',
  '🚀 🎯 💡 🔥 ⭐ ✨ 🎉 🏆',
  '🛠️ ⚙️ 🧪 🐛 🔒 🔑 📦 🧩',
  '📈 📊 🗺️ 🧭 📅 ⏰ ✅ ❗',
  '💬 📣 🤝 👋 ❤️ 🌱 🎨 🧠',
].flatMap(row => row.split(' '))

interface DocumentIconPickerProps {
  value: string | null
  onChange: (icon: string | null) => void
  /** The button that opens the picker (rendered with PopoverTrigger asChild). */
  trigger: ReactNode
}

/** A popover with a grid of emojis for the document icon, plus "Remove icon". */
export function DocumentIconPicker({ value, onChange, trigger }: DocumentIconPickerProps) {
  const [open, setOpen] = useState(false)
  const pick = (icon: string | null) => {
    onChange(icon)
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-[296px] p-2">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="text-mini font-medium text-text-secondary">Choose icon</span>
          {value ? (
            <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => pick(null)}>
              Remove
            </Button>
          ) : null}
        </div>
        <div role="listbox" aria-label="Icons" className="grid grid-cols-8 gap-0.5">
          {DOCUMENT_EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              role="option"
              aria-selected={emoji === value}
              aria-label={`Icon ${emoji}`}
              onClick={() => pick(emoji)}
              className="flex size-8 items-center justify-center rounded-md text-[18px] leading-none hover:bg-surface-hover aria-selected:bg-surface-active"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
