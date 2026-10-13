import { Extension, type Editor, type Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { Suggestion, exitSuggestion, type SuggestionOptions } from '@tiptap/suggestion'
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  TextQuote,
  type LucideIcon,
} from 'lucide-react'

export interface SlashCommandItem {
  id: string
  title: string
  description: string
  /** Extra words the filter matches (by prefix). */
  keywords: string[]
  icon: LucideIcon
  /** Markdown shortcut shown on the right, for discoverability. */
  hint?: string
  run: (editor: Editor, range: Range) => void
}

const start = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range)

export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  {
    id: 'paragraph',
    title: 'Text',
    description: 'Plain paragraph',
    keywords: ['paragraph', 'text', 'plain'],
    icon: Pilcrow,
    run: (editor, range) => start(editor, range).setParagraph().run(),
  },
  {
    id: 'heading-1',
    title: 'Heading 1',
    description: 'Large section heading',
    keywords: ['h1', 'title', 'heading'],
    icon: Heading1,
    hint: '#',
    run: (editor, range) => start(editor, range).setHeading({ level: 1 }).run(),
  },
  {
    id: 'heading-2',
    title: 'Heading 2',
    description: 'Medium section heading',
    keywords: ['h2', 'subtitle', 'heading'],
    icon: Heading2,
    hint: '##',
    run: (editor, range) => start(editor, range).setHeading({ level: 2 }).run(),
  },
  {
    id: 'heading-3',
    title: 'Heading 3',
    description: 'Small section heading',
    keywords: ['h3', 'heading'],
    icon: Heading3,
    hint: '###',
    run: (editor, range) => start(editor, range).setHeading({ level: 3 }).run(),
  },
  {
    id: 'bullet-list',
    title: 'Bulleted list',
    description: 'Simple list with bullets',
    keywords: ['ul', 'unordered', 'bullet', 'list'],
    icon: List,
    hint: '-',
    run: (editor, range) => start(editor, range).toggleBulletList().run(),
  },
  {
    id: 'ordered-list',
    title: 'Numbered list',
    description: 'List with numbers',
    keywords: ['ol', 'ordered', 'number', 'list'],
    icon: ListOrdered,
    hint: '1.',
    run: (editor, range) => start(editor, range).toggleOrderedList().run(),
  },
  {
    id: 'task-list',
    title: 'Checklist',
    description: 'Track tasks with checkboxes',
    keywords: ['todo', 'task', 'checkbox', 'check'],
    icon: ListChecks,
    hint: '[ ]',
    run: (editor, range) => start(editor, range).toggleTaskList().run(),
  },
  {
    id: 'blockquote',
    title: 'Quote',
    description: 'Capture a quotation',
    keywords: ['blockquote', 'citation'],
    icon: TextQuote,
    hint: '>',
    run: (editor, range) => start(editor, range).toggleBlockquote().run(),
  },
  {
    id: 'code-block',
    title: 'Code block',
    description: 'Monospaced code snippet',
    keywords: ['code', 'snippet', 'pre'],
    icon: Code2,
    hint: '```',
    run: (editor, range) => start(editor, range).toggleCodeBlock().run(),
  },
  {
    id: 'divider',
    title: 'Divider',
    description: 'Horizontal line between sections',
    keywords: ['hr', 'rule', 'separator', 'line'],
    icon: Minus,
    hint: '---',
    run: (editor, range) => start(editor, range).setHorizontalRule().run(),
  },
]

/** Title matches by substring, keywords by prefix. Items whose title starts with the query come first. */
export function filterSlashCommandItems(
  query: string,
  items: SlashCommandItem[] = SLASH_COMMAND_ITEMS
): SlashCommandItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  const matches = items.filter(
    item =>
      item.title.toLowerCase().includes(q) || item.keywords.some(keyword => keyword.startsWith(q))
  )
  const rank = (item: SlashCommandItem) => (item.title.toLowerCase().startsWith(q) ? 0 : 1)
  return matches.sort((a, b) => rank(a) - rank(b))
}

export interface SlashMenuState {
  open: boolean
  items: SlashCommandItem[]
  selectedIndex: number
  /** Viewport rectangle of the typed `/query`, for positioning. */
  rect: DOMRect | null
}

const CLOSED: SlashMenuState = { open: false, items: [], selectedIndex: 0, rect: null }

type SuggestionRender = NonNullable<SuggestionOptions<SlashCommandItem, SlashCommandItem>['render']>

export interface SlashMenuStore {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => SlashMenuState
  choose: (index: number) => void
  highlight: (index: number) => void
  render: SuggestionRender
}

/** A tiny external store that connects the Suggestion plugin to the React menu. */
export function createSlashMenuStore(): SlashMenuStore {
  let state = CLOSED
  let command: ((item: SlashCommandItem) => void) | null = null
  let view: EditorView | null = null
  const listeners = new Set<() => void>()

  const set = (next: SlashMenuState) => {
    state = next
    listeners.forEach(listener => listener())
  }

  const choose = (index: number) => {
    const item = state.items[index]
    if (item && command) command(item)
  }

  const close = () => {
    if (view) exitSuggestion(view, slashCommandPluginKey)
    set(CLOSED)
  }

  // Radix overlays (Dialog, Sheet, Popover) listen for Escape on `document` in
  // the capture phase, before ProseMirror sees the key. Listen earlier, on
  // `window`, so Escape closes only this menu and not the dialog around it.
  const onWindowEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.isComposing || !state.open) return
    event.preventDefault()
    event.stopPropagation()
    close()
  }
  const listenForEscape = (listen: boolean) => {
    if (typeof window === 'undefined') return
    if (listen) window.addEventListener('keydown', onWindowEscape, { capture: true })
    else window.removeEventListener('keydown', onWindowEscape, { capture: true })
  }

  const render: SuggestionRender = () => ({
    onStart: props => {
      command = props.command
      view = props.editor.view
      listenForEscape(true)
      set({ open: true, items: props.items, selectedIndex: 0, rect: props.clientRect?.() ?? null })
    },
    onUpdate: props => {
      command = props.command
      set({ open: true, items: props.items, selectedIndex: 0, rect: props.clientRect?.() ?? null })
    },
    onExit: () => {
      command = null
      view = null
      listenForEscape(false)
      set(CLOSED)
    },
    onKeyDown: ({ event, view: editorView }) => {
      if (!state.open) return false
      const count = state.items.length
      switch (event.key) {
        case 'ArrowDown':
          if (count) set({ ...state, selectedIndex: (state.selectedIndex + 1) % count })
          return true
        case 'ArrowUp':
          if (count) set({ ...state, selectedIndex: (state.selectedIndex - 1 + count) % count })
          return true
        case 'Enter':
        case 'Tab':
          if (!count) return false
          choose(state.selectedIndex)
          return true
        case 'Escape':
          exitSuggestion(editorView, slashCommandPluginKey)
          set(CLOSED)
          return true
        default:
          return false
      }
    },
  })

  return {
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => state,
    choose,
    highlight: index => {
      if (state.open && index !== state.selectedIndex) set({ ...state, selectedIndex: index })
    },
    render,
  }
}

export const slashCommandPluginKey = new PluginKey('slashCommand')

/** Typing `/` at the start of a line or after a space opens the block menu. */
export function createSlashCommand(
  store: SlashMenuStore,
  items: SlashCommandItem[] = SLASH_COMMAND_ITEMS
) {
  return Extension.create({
    name: 'slashCommand',
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashCommandItem, SlashCommandItem>({
          editor: this.editor,
          pluginKey: slashCommandPluginKey,
          char: '/',
          items: ({ query }) => filterSlashCommandItems(query, items),
          allow: ({ state }) => !state.selection.$from.parent.type.spec.code,
          command: ({ editor, range, props }) => props.run(editor, range),
          render: store.render,
        }),
      ]
    },
  })
}
