import * as React from 'react'
import { cn } from '@/lib/utils'

interface IssueTitleInputProps {
  value: string
  /** Called with the trimmed title on blur or Enter, only when it changed and is not empty. */
  onSave: (title: string) => void
  className?: string
  /** Gives the page the textarea (e.g. to focus it with the R shortcut). */
  ref?: React.Ref<HTMLTextAreaElement>
}

/** Sets the textarea's height to its content, so every line of the title shows. */
function fitHeight(el: HTMLTextAreaElement) {
  el.style.height = '0px'
  el.style.height = `${el.scrollHeight}px`
}

/**
 * Inline-editable issue title (looks like text, no border). The textarea grows
 * with the text. Enter saves, Shift+Enter is ignored (titles are one line),
 * Escape restores the saved title. An empty title is not saved.
 */
export function IssueTitleInput({ value, onSave, className, ref: outerRef }: IssueTitleInputProps) {
  const [draft, setDraft] = React.useState(value)
  const [editing, setEditing] = React.useState(false)
  const ref = React.useRef<HTMLTextAreaElement>(null)
  React.useImperativeHandle(outerRef, () => ref.current as HTMLTextAreaElement, [])

  // Follow outside changes while the user is not editing.
  const shown = editing ? draft : value

  React.useLayoutEffect(() => {
    const el = ref.current
    if (el) fitHeight(el)
  }, [shown])

  // A narrower or wider page wraps the title into more or fewer lines: fit the height again.
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    let width = el.clientWidth
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return
      width = el.clientWidth
      fitHeight(el)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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
        'w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-2xl leading-tight font-semibold tracking-tight text-foreground outline-none placeholder:text-text-tertiary',
        className
      )}
    />
  )
}
