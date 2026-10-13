import * as React from 'react'

type NativeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange'
>

export interface DateInputProps extends NativeInputProps {
  /** The saved date (`YYYY-MM-DD`) or null. */
  value: string | null
  /** Called once with the finished date; null when the native picker clears it. */
  onCommit: (date: string | null) => void
}

/**
 * A native date input that saves a typed date only when it is finished.
 *
 * While the user types, every year digit already makes a valid value
 * ("0002-11-20", "0020-11-20", ...). A keyboard edit is kept as a draft and
 * committed on Enter, on blur or when the input unmounts (e.g. a popover
 * closes). A pick from the calendar (or a paste/fill) commits at once.
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onCommit, onKeyDown, onPointerDown, onBlur, ...props }, ref) => {
    const [draft, setDraft] = React.useState(value ?? '')
    const [prevValue, setPrevValue] = React.useState(value)
    const typing = React.useRef(false)
    const pending = React.useRef<string | null>(null)
    const latest = React.useRef({ value, onCommit })
    React.useLayoutEffect(() => {
      latest.current = { value, onCommit }
    })

    // A new saved value (e.g. after a commit or "Clear") replaces the draft.
    if (value !== prevValue) {
      setPrevValue(value)
      setDraft(value ?? '')
    }

    const commit = React.useCallback(() => {
      const next = pending.current
      pending.current = null
      // An unfinished date reads as "": nothing to save.
      if (next && next !== latest.current.value) latest.current.onCommit(next)
    }, [])

    React.useEffect(() => commit, [commit])

    return (
      <input
        ref={ref}
        type="date"
        value={draft}
        onKeyDown={event => {
          typing.current = true
          if (event.key === 'Enter') commit()
          onKeyDown?.(event)
        }}
        onPointerDown={event => {
          typing.current = false
          onPointerDown?.(event)
        }}
        onChange={event => {
          const next = event.target.value
          setDraft(next)
          if (typing.current) {
            pending.current = next
            return
          }
          pending.current = null
          const date = next || null
          if (date !== latest.current.value) latest.current.onCommit(date)
        }}
        onBlur={event => {
          typing.current = false
          commit()
          onBlur?.(event)
        }}
        {...props}
      />
    )
  }
)
DateInput.displayName = 'DateInput'
