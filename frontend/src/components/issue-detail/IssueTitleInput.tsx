import * as React from 'react'
import { cn } from '@/lib/utils'

interface IssueTitleInputProps {
  value: string
  /** Called with the trimmed title on blur or Enter, only when it changed and is not empty. */
  onSave: (title: string) => void
  className?: string
}

/**
 * Inline-editable issue title (looks like text, no border). The textarea grows
 * with the text. Enter saves, Shift+Enter is ignored (titles are one line),
 * Escape restores the saved title. An empty title is not saved.
 */
export function IssueTitleInput({ value, onSave, className }: IssueTitleInputProps) {
  const [draft, setDraft] = React.useState(value)
  const [editing, setEditing] = React.useState(false)
  const ref = React.useRef<HTMLTextAreaElement>(null)

  // Follow outside changes while the user is not editing.
  const shown = editing ? draft : value

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [shown])

  const commit = () => {
    const next = draft.replace(/\s+/g, ' ').trim()
    setEditing(false)
    if (next && next !== value) onSave(next)
    else setDraft(value)
  }

  return (
    <textarea
      ref={ref}
      aria-label="Issue title"
      placeholder="Issue title"
      rows={1}
      maxLength={500}
      value={shown}
      onFocus={() => {
        setDraft(value)
        setEditing(true)
      }}
      onChange={event => setDraft(event.target.value.replace(/\n/g, ''))}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          setDraft(value)
          setEditing(false)
          // Blur after the reset so commit() sees the saved title.
          requestAnimationFrame(() => ref.current?.blur())
        }
      }}
      className={cn(
        'w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-title leading-snug font-semibold text-foreground outline-none placeholder:text-text-tertiary',
        className
      )}
    />
  )
}
