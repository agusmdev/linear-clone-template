import { useCallback, useEffect, useRef, useState } from 'react'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface AutosaveResult {
  status: AutosaveStatus
  /** The error of the last failed save, or null. */
  error: unknown
  /** Saves the newest value now, without waiting for the delay. Also retries after an error. */
  flush: () => void
}

export interface AutosaveContext {
  /**
   * True when the page is being hidden, reloaded or closed. The save must then
   * send its request with `keepalive`, or the browser cancels it.
   */
  keepalive: boolean
}

const NOT_SAVED: unique symbol = Symbol('not-saved')

/**
 * Saves `value` after it has not changed for `delay` ms. The first value is
 * taken as already saved. A pending change is saved when the component unmounts,
 * and with `keepalive` when the page is hidden, reloaded or closed (a reload or
 * a closed tab does not unmount React components).
 * When saves overlap, only the newest one sets the status.
 */
export function useDebouncedAutosave<T>(
  value: T,
  save: (value: T, context: AutosaveContext) => Promise<unknown> | unknown,
  delay = 800
): AutosaveResult {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [error, setError] = useState<unknown>(null)
  const saveRef = useRef(save)
  const valueRef = useRef(value)
  const lastSavedRef = useRef<T | typeof NOT_SAVED>(value)
  const requestRef = useRef(0)

  useEffect(() => {
    saveRef.current = save
    valueRef.current = value
  })

  const runSave = useCallback(async (next: T, keepalive = false) => {
    if (Object.is(next, lastSavedRef.current)) return
    const request = ++requestRef.current
    lastSavedRef.current = next
    setStatus('saving')
    try {
      await saveRef.current(next, { keepalive })
      if (request === requestRef.current) {
        setError(null)
        setStatus('saved')
      }
    } catch (caught) {
      if (request === requestRef.current) {
        lastSavedRef.current = NOT_SAVED
        setError(caught)
        setStatus('error')
      }
    }
  }, [])

  useEffect(() => {
    if (Object.is(value, lastSavedRef.current)) return
    const timer = setTimeout(() => void runSave(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay, runSave])

  useEffect(() => {
    const flushOnExit = () => void runSave(valueRef.current, true)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushOnExit()
    }
    window.addEventListener('pagehide', flushOnExit)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flushOnExit)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [runSave])

  useEffect(
    () => () => {
      if (Object.is(valueRef.current, lastSavedRef.current)) return
      try {
        void Promise.resolve(saveRef.current(valueRef.current, { keepalive: false })).catch(
          () => undefined
        )
      } catch {
        // The component is gone: there is no status left to report.
      }
    },
    []
  )

  const flush = useCallback(() => void runSave(valueRef.current), [runSave])

  return { status, error, flush }
}
