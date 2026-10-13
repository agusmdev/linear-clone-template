/** A single key press with its modifiers. */
export interface KeyCombo {
  key: string
  mod: boolean
  ctrl: boolean
  meta: boolean
  alt: boolean
  shift: boolean
}

const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  space: ' ',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  del: 'delete',
  plus: '+',
}

/** True on macOS / iOS, where "mod" means the Command key. */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent)
}

/** Parse one combo like "mod+shift+k" or "?". */
export function parseCombo(input: string): KeyCombo {
  const combo: KeyCombo = {
    key: '',
    mod: false,
    ctrl: false,
    meta: false,
    alt: false,
    shift: false,
  }
  // A trailing "+" (as in "+" or "mod++") is the plus key, not a separator.
  const parts = input === '+' ? ['+'] : input.toLowerCase().split(/\+(?!$)/)
  for (const raw of parts) {
    const part = raw.trim()
    if (part === 'mod') combo.mod = true
    else if (part === 'ctrl' || part === 'control') combo.ctrl = true
    else if (part === 'meta' || part === 'cmd' || part === 'command') combo.meta = true
    else if (part === 'alt' || part === 'option') combo.alt = true
    else if (part === 'shift') combo.shift = true
    else combo.key = KEY_ALIASES[part] ?? part
  }
  return combo
}

/** Parse a shortcut string. Spaces split a sequence: "g i" is "g" then "i". */
export function parseShortcut(input: string): KeyCombo[] {
  return input.trim().split(/\s+/).filter(Boolean).map(parseCombo)
}

/** Does a keyboard event match a combo? `mod` is Cmd on Mac, Ctrl elsewhere. */
export function matchesCombo(event: KeyboardEvent, combo: KeyCombo, isMac: boolean): boolean {
  if (event.key.toLowerCase() !== combo.key) return false

  const wantMeta = combo.meta || (combo.mod && isMac)
  const wantCtrl = combo.ctrl || (combo.mod && !isMac)
  if (event.metaKey !== wantMeta) return false
  if (event.ctrlKey !== wantCtrl) return false
  if (event.altKey !== combo.alt) return false

  // Letters and named keys check Shift exactly. Symbols such as "?" need Shift
  // on most layouts, so Shift is ignored for them unless the combo asks for it.
  if (combo.shift) return event.shiftKey
  const isSymbol = combo.key.length === 1 && !/[a-z0-9]/.test(combo.key)
  return isSymbol || !event.shiftKey
}

const MODIFIER_KEYS = new Set(['shift', 'control', 'alt', 'meta', 'os', 'capslock', 'fn'])

/** True when the event is only a modifier key going down. */
export function isModifierOnly(event: KeyboardEvent): boolean {
  return MODIFIER_KEYS.has(event.key.toLowerCase())
}

const NON_TEXT_INPUTS = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'range',
  'color',
  'file',
])

/** True when the event target is a text field, a select or editable content. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.has((target as HTMLInputElement).type)
  return false
}

const KEY_LABELS: Record<string, string> = {
  escape: 'Esc',
  enter: '↵',
  ' ': 'Space',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  backspace: '⌫',
  delete: 'Del',
  tab: 'Tab',
}

/**
 * Turn a shortcut string into display labels: one array per sequence step.
 * "mod+k" -> [["⌘", "K"]] on Mac, [["Ctrl", "K"]] elsewhere. "g i" -> [["G"], ["I"]].
 */
export function formatShortcut(input: string, isMac = isMacPlatform()): string[][] {
  return parseShortcut(input).map(combo => {
    const labels: string[] = []
    if (combo.ctrl || (combo.mod && !isMac)) labels.push(isMac ? '⌃' : 'Ctrl')
    if (combo.alt) labels.push(isMac ? '⌥' : 'Alt')
    if (combo.shift) labels.push(isMac ? '⇧' : 'Shift')
    if (combo.meta || (combo.mod && isMac)) labels.push(isMac ? '⌘' : 'Win')
    labels.push(KEY_LABELS[combo.key] ?? combo.key.toUpperCase())
    return labels
  })
}
