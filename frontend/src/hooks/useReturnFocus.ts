import { useState } from 'react'

function focusedElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const active = document.activeElement
  return active instanceof HTMLElement && active !== document.body ? active : null
}

/**
 * `onCloseAutoFocus` for a Radix dialog opened without a trigger (a keyboard
 * shortcut, a window event). Radix gives focus back to the dialog's trigger
 * only, so without one focus falls to <body> on close and list keys (J/K/S/P)
 * stop working. This remembers what had focus when `open` became true and
 * focuses it again on close, if it is still on the page.
 */
export function useReturnFocus(open: boolean) {
  // Read while rendering the open state: before the dialog (or an `autoFocus`
  // field in it) takes focus.
  const [opener, setOpener] = useState<HTMLElement | null>(null)
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setOpener(focusedElement())
  }

  return {
    onCloseAutoFocus: (event: Event) => {
      if (!opener?.isConnected) return
      event.preventDefault()
      opener.focus({ preventScroll: true })
    },
  }
}
