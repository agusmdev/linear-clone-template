import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'

import {
  isMacPlatform,
  isModifierOnly,
  isTypingTarget,
  matchesCombo,
  parseShortcut,
  type KeyCombo,
} from './keys'

/** Time window between the steps of a sequence such as "g i". */
export const SEQUENCE_TIMEOUT_MS = 1000

/** The scope that is always active. */
export const GLOBAL_SCOPE = 'global'

interface Registration {
  id: number
  sequence: KeyCombo[]
  scope: string
  allowInInputs: boolean
  preventDefault: boolean
  handlerRef: { current: (event: KeyboardEvent) => void }
}

interface ShortcutsContextValue {
  register: (registration: Omit<Registration, 'id'>) => () => void
  activateScope: (scope: string) => () => void
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null)

export interface ShortcutsProviderProps {
  children: ReactNode
  /** Turn every shortcut off, e.g. while a modal owns the keyboard. Default: false. */
  disabled?: boolean
}

/**
 * Owns one `keydown` listener on `window` and routes key presses to the
 * shortcuts registered with `useShortcut`. Supports single keys, modifier
 * combos ("mod+k") and sequences ("g i") with a 1 s timeout.
 */
export function ShortcutsProvider({ children, disabled = false }: ShortcutsProviderProps) {
  const registrations = useRef(new Map<number, Registration>())
  const scopeCounts = useRef(new Map<string, number>())
  const nextId = useRef(0)
  const buffer = useRef<KeyboardEvent[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (disabled) return
    const isMac = isMacPlatform()

    const clearBuffer = () => {
      buffer.current = []
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
    }

    const isScopeActive = (scope: string) =>
      scope === GLOBAL_SCOPE || (scopeCounts.current.get(scope) ?? 0) > 0

    // Matches `events` against the start of each active sequence.
    const findMatches = (events: KeyboardEvent[], typing: boolean) => {
      let exact: Registration | null = null
      let hasPrefix = false
      for (const reg of registrations.current.values()) {
        if (!isScopeActive(reg.scope)) continue
        if (typing && !reg.allowInInputs) continue
        if (reg.sequence.length < events.length) continue
        const matches = events.every((e, i) => matchesCombo(e, reg.sequence[i], isMac))
        if (!matches) continue
        if (reg.sequence.length === events.length) {
          // The newest registration wins, so a nested screen can override.
          if (!exact || reg.id > exact.id) exact = reg
        } else {
          hasPrefix = true
        }
      }
      return { exact, hasPrefix }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || isModifierOnly(event)) return
      const typing = isTypingTarget(event.target)

      // Try the sequence so far plus this key, then this key alone.
      const candidates = buffer.current.length ? [[...buffer.current, event], [event]] : [[event]]
      for (const events of candidates) {
        const { exact, hasPrefix } = findMatches(events, typing)
        if (exact) {
          clearBuffer()
          if (exact.preventDefault) event.preventDefault()
          exact.handlerRef.current(event)
          return
        }
        if (hasPrefix) {
          buffer.current = events
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(clearBuffer, SEQUENCE_TIMEOUT_MS)
          return
        }
      }
      clearBuffer()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      clearBuffer()
    }
  }, [disabled])

  const value = useMemo<ShortcutsContextValue>(
    () => ({
      register: registration => {
        const id = nextId.current++
        registrations.current.set(id, { ...registration, id })
        return () => {
          registrations.current.delete(id)
        }
      },
      activateScope: scope => {
        const counts = scopeCounts.current
        counts.set(scope, (counts.get(scope) ?? 0) + 1)
        return () => {
          const next = (counts.get(scope) ?? 1) - 1
          if (next <= 0) counts.delete(scope)
          else counts.set(scope, next)
        }
      },
    }),
    []
  )

  return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>
}

function useShortcutsContext(hookName: string): ShortcutsContextValue {
  const context = useContext(ShortcutsContext)
  if (!context) throw new Error(`${hookName} must be used inside <ShortcutsProvider>`)
  return context
}

export interface UseShortcutOptions {
  /** Register the shortcut only while true. Default: true. */
  enabled?: boolean
  /** Fire only while this scope is active (see `useShortcutScope`). Default: "global". */
  scope?: string
  /** Also fire while focus is in an input, textarea or contenteditable. Default: false. */
  allowInInputs?: boolean
  /** Call `event.preventDefault()` when the shortcut fires. Default: true. */
  preventDefault?: boolean
}

/**
 * Run `handler` when `keys` is pressed.
 *
 * `keys` is "c", "/", "?", "mod+k", "shift+a" or a sequence such as "g i".
 * Pass an array to bind several shortcuts to the same handler.
 */
export function useShortcut(
  keys: string | string[],
  handler: (event: KeyboardEvent) => void,
  options: UseShortcutOptions = {}
): void {
  const { register } = useShortcutsContext('useShortcut')
  const {
    enabled = true,
    scope = GLOBAL_SCOPE,
    allowInInputs = false,
    preventDefault = true,
  } = options
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  const keyList = Array.isArray(keys) ? keys.join('\n') : keys

  useEffect(() => {
    if (!enabled) return
    const unregisters = keyList
      .split('\n')
      .filter(k => k.trim() !== '')
      .map(k =>
        register({
          sequence: parseShortcut(k),
          scope,
          allowInInputs,
          preventDefault,
          handlerRef,
        })
      )
    return () => unregisters.forEach(unregister => unregister())
  }, [register, keyList, enabled, scope, allowInInputs, preventDefault])
}

/**
 * Activate `scope` while the calling component is mounted (and `active` is true).
 * Shortcuts registered with `{ scope }` fire only while their scope is active.
 */
export function useShortcutScope(scope: string, active = true): void {
  const { activateScope } = useShortcutsContext('useShortcutScope')
  useEffect(() => {
    if (!active) return
    return activateScope(scope)
  }, [activateScope, scope, active])
}
