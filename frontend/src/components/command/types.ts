import type { ReactNode } from 'react'

/** One selectable row in the command palette. */
export interface CommandItemData {
  id: string
  label: string
  icon?: ReactNode
  /** Shortcut string shown on the right, e.g. "c", "mod+k", "g i". */
  shortcut?: string
  /** Extra words that match this item when filtering. */
  keywords?: string[]
  /** Runs when the item is selected. Not needed when `children` is set. */
  onSelect?: () => void
  /** Nested page: selecting the item opens these groups as a sub-list. */
  children?: CommandGroupData[]
  /** Input placeholder on the nested page. */
  childrenPlaceholder?: string
  /** Keep the palette open after `onSelect`. Default: false (closes). */
  keepOpen?: boolean
}

/** A titled group of command items. */
export interface CommandGroupData {
  heading: string
  items: CommandItemData[]
}

/** One row in the shortcuts help dialog. */
export interface ShortcutHelpItem {
  /** Shortcut string, e.g. "c", "mod+k", "g i". */
  keys: string
  description: string
}

/** A titled group in the shortcuts help dialog. */
export interface ShortcutHelpGroup {
  heading: string
  shortcuts: ShortcutHelpItem[]
}
