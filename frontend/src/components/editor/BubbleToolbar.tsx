import { NodeSelection, PluginKey } from '@tiptap/pm/state'
import { useEditorState, type Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Strikethrough,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

export interface BubbleToolbarProps {
  editor: Editor
}

interface ToolbarButtonProps {
  icon: LucideIcon
  label: string
  shortcut?: string
  active: boolean
  onClick: () => void
}

function ToolbarButton({ icon: Icon, label, shortcut, active, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      className="rte-toolbar-button flex size-7 items-center justify-center rounded-md"
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
    >
      <Icon className="size-[15px]" aria-hidden="true" />
    </button>
  )
}

/** Adds `https://` to bare domains such as `linear.app/docs`. */
export function normalizeHref(input: string): string {
  const value = input.trim()
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('/') || value.startsWith('#')) {
    return value
  }
  return `https://${value}`
}

interface LinkInputProps {
  editor: Editor
  initialHref: string
  onDone: () => void
}

function LinkInput({ editor, initialHref, onDone }: LinkInputProps) {
  const [href, setHref] = useState(initialHref)

  const apply = () => {
    const chain = editor.chain().focus().extendMarkRange('link')
    if (href.trim()) chain.setLink({ href: normalizeHref(href) }).run()
    else chain.unsetLink().run()
    onDone()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      apply()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      editor.commands.focus()
      onDone()
    }
  }

  return (
    <div className="flex items-center gap-1 px-1">
      <input
        // The input opens on an explicit user click, so moving focus is expected.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        type="url"
        value={href}
        placeholder="Paste or type a link…"
        aria-label="Link URL"
        className="h-7 w-56 bg-transparent px-1.5 text-[13px] text-[var(--rte-text)] outline-none placeholder:text-[var(--rte-muted)]"
        onChange={event => setHref(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="rte-toolbar-button h-7 rounded-md px-2 text-[12px]"
        onClick={apply}
      >
        {href.trim() ? 'Save' : 'Remove'}
      </button>
    </div>
  )
}

/** Formatting toolbar that floats above a non-empty text selection. */
export function BubbleToolbar({ editor }: BubbleToolbarProps) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [pluginKey] = useState(() => new PluginKey('bubbleToolbar'))
  const menuRef = useRef<HTMLDivElement>(null)
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      h1: current.isActive('heading', { level: 1 }),
      h2: current.isActive('heading', { level: 2 }),
      h3: current.isActive('heading', { level: 3 }),
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      strike: current.isActive('strike'),
      code: current.isActive('code'),
      link: current.isActive('link'),
      href: (current.getAttributes('link').href as string | undefined) ?? '',
    }),
  })

  const chain = () => editor.chain().focus()

  // Hide when focus leaves the editor for anything but the toolbar. TipTap's own
  // blur handling skips the first blur after a mousedown on the menu, and the
  // buttons keep the editor focused on mousedown, so after a button click the
  // toolbar would stay up over the page once the user clicks elsewhere.
  useEffect(() => {
    const onBlur = ({ event }: { event: FocusEvent }) => {
      const next = event.relatedTarget
      if (next instanceof Node && menuRef.current?.contains(next)) return
      // TipTap emits blur while it dispatches a transaction: hide just after.
      queueMicrotask(() => {
        if (editor.isDestroyed || editor.isFocused) return
        editor.view.dispatch(editor.state.tr.setMeta(pluginKey, 'hide'))
      })
    }
    editor.on('blur', onBlur)
    return () => {
      editor.off('blur', onBlur)
    }
  }, [editor, pluginKey])

  return (
    <BubbleMenu
      ref={menuRef}
      editor={editor}
      pluginKey={pluginKey}
      className="rte-root rte-menu z-50 flex items-center gap-0.5 p-1"
      options={{
        placement: 'top',
        offset: 8,
        flip: true,
        shift: { padding: 8 },
        onHide: () => setLinkOpen(false),
      }}
      shouldShow={({ editor: current, element, view, state, from, to }) => {
        if (!current.isEditable || from === to) return false
        if (state.selection instanceof NodeSelection) return false
        if (current.isActive('codeBlock')) return false
        if (!state.doc.textBetween(from, to).trim()) return false
        return view.hasFocus() || element.contains(document.activeElement)
      }}
    >
      {linkOpen ? (
        <LinkInput editor={editor} initialHref={active.href} onDone={() => setLinkOpen(false)} />
      ) : (
        <>
          <ToolbarButton
            icon={Heading1}
            label="Heading 1"
            active={active.h1}
            onClick={() => chain().toggleHeading({ level: 1 }).run()}
          />
          <ToolbarButton
            icon={Heading2}
            label="Heading 2"
            active={active.h2}
            onClick={() => chain().toggleHeading({ level: 2 }).run()}
          />
          <ToolbarButton
            icon={Heading3}
            label="Heading 3"
            active={active.h3}
            onClick={() => chain().toggleHeading({ level: 3 }).run()}
          />
          <span className="mx-0.5 h-4 w-px bg-[var(--rte-border)]" aria-hidden="true" />
          <ToolbarButton
            icon={Bold}
            label="Bold"
            shortcut="Mod+B"
            active={active.bold}
            onClick={() => chain().toggleBold().run()}
          />
          <ToolbarButton
            icon={Italic}
            label="Italic"
            shortcut="Mod+I"
            active={active.italic}
            onClick={() => chain().toggleItalic().run()}
          />
          <ToolbarButton
            icon={Strikethrough}
            label="Strikethrough"
            shortcut="Mod+Shift+S"
            active={active.strike}
            onClick={() => chain().toggleStrike().run()}
          />
          <ToolbarButton
            icon={Code}
            label="Inline code"
            shortcut="Mod+E"
            active={active.code}
            onClick={() => chain().toggleCode().run()}
          />
          <span className="mx-0.5 h-4 w-px bg-[var(--rte-border)]" aria-hidden="true" />
          <ToolbarButton
            icon={Link2}
            label={active.link ? 'Edit link' : 'Add link'}
            active={active.link}
            onClick={() => setLinkOpen(true)}
          />
        </>
      )}
    </BubbleMenu>
  )
}
