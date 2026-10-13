import { createDocument, type Editor } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

import { BubbleToolbar } from './BubbleToolbar'
import { createBaseExtensions } from './extensions'
import { IssueReference, issueReferencePluginKey, type RenderIssueHref } from './issue-reference'
import { RichTextContent } from './RichTextContent'
import { createSlashCommand, createSlashMenuStore } from './slash-command'
import { SlashMenu } from './SlashMenu'
import './editor.css'

export interface RichTextEditorProps {
  /** HTML content. An empty document is `''`. */
  value: string
  /** Called with the new HTML on every change (`''` when empty). */
  onChange?: (html: string) => void
  /** Called with the current HTML when the editor loses focus. */
  onBlur?: (html: string) => void
  /** Shown while the document is empty. Read once, on mount. */
  placeholder?: string
  editable?: boolean
  /** Focus the end of the document on mount. */
  autofocus?: boolean
  className?: string
  /** Accessible name of the text box. */
  ariaLabel?: string
  /** Turns issue identifiers such as `ENG-123` into links. */
  renderIssueHref?: RenderIssueHref
  /** Called on a click on an issue link. Without it, Mod+click opens the href in a new tab. */
  onIssueClick?: (identifier: string, event: MouseEvent) => void
}

type EditorCallbacks = Pick<
  RichTextEditorProps,
  'onChange' | 'onBlur' | 'renderIssueHref' | 'onIssueClick'
>

/** Holds the newest callbacks so the editor, created once, never calls stale ones. */
function createCallbackBox<T>(initial: T) {
  let current = initial
  return {
    get: () => current,
    set: (next: T) => {
      current = next
    },
  }
}

function serialize(editor: Editor) {
  return editor.isEmpty ? '' : editor.getHTML()
}

/**
 * Linear-style rich text editor (TipTap). Works with server rendering: the
 * server and the first client render show `RichTextContent`, then the editor mounts.
 */
export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder = 'Add description…',
  editable = true,
  autofocus = false,
  className,
  ariaLabel = 'Rich text editor',
  renderIssueHref,
  onIssueClick,
}: RichTextEditorProps) {
  const [slashStore] = useState(createSlashMenuStore)
  const [callbacks] = useState(() =>
    createCallbackBox<EditorCallbacks>({ onChange, onBlur, renderIssueHref, onIssueClick })
  )
  const lastHtml = useRef(value)

  useEffect(() => {
    callbacks.set({ onChange, onBlur, renderIssueHref, onIssueClick })
  })

  const [extensions] = useState(() => [
    ...createBaseExtensions({ placeholder }),
    IssueReference.configure({ getRenderIssueHref: () => callbacks.get().renderIssueHref }),
    createSlashCommand(slashStore),
  ])

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions,
    content: value,
    editable,
    autofocus: autofocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'rte-prose rte-input',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': ariaLabel,
      },
      handleClick: (view, _pos, event) => {
        if (!(event.target instanceof Element)) return false
        const anchor = event.target.closest('a')
        if (!anchor) return false
        const issue = anchor.getAttribute('data-issue-ref')
        const { onIssueClick: handleIssueClick } = callbacks.get()
        if (issue && handleIssueClick) {
          event.preventDefault()
          handleIssueClick(issue, event)
          return true
        }
        const href = anchor.getAttribute('href')
        if (view.editable && href && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          window.open(href, '_blank', 'noopener,noreferrer')
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = serialize(current)
      lastHtml.current = html
      callbacks.get().onChange?.(html)
    },
    onBlur: ({ editor: current }) => callbacks.get().onBlur?.(serialize(current)),
  })

  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.isEditable !== editable) {
      editor.setEditable(editable, false)
    }
  }, [editor, editable])

  // Apply outside changes to `value`. Skipped while the user types, so a late
  // echo of an older value cannot reset the cursor.
  useEffect(() => {
    if (!editor || editor.isDestroyed || value === lastHtml.current) return
    if (editor.isFocused) return
    lastHtml.current = value
    if (value === serialize(editor)) return
    // Replace the document without emitting an update (same as setContent with emitUpdate: false).
    const doc = createDocument(value, editor.schema)
    const { tr } = editor.state
    tr.replaceWith(0, tr.doc.content.size, doc.content).setMeta('preventUpdate', true)
    editor.view.dispatch(tr)
  }, [editor, value])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.view.dispatch(editor.state.tr.setMeta(issueReferencePluginKey, true))
  }, [editor, renderIssueHref])

  if (!editor) {
    return (
      <div className={cn('rte-root', className)}>
        {value ? (
          <RichTextContent html={value} className="rte-input" renderIssueHref={renderIssueHref} />
        ) : (
          <div className="rte-prose rte-input">
            <p className="rte-static-placeholder">{placeholder}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('rte-root', className)} data-editable={editable || undefined}>
      <EditorContent editor={editor} />
      {editable ? <BubbleToolbar editor={editor} /> : null}
      <SlashMenu store={slashStore} />
    </div>
  )
}
