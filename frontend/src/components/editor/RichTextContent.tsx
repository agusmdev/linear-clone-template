import { generateHTML, generateJSON, type Extensions } from '@tiptap/core'
import { useMemo, useSyncExternalStore, type MouseEvent } from 'react'

import { cn } from '@/lib/utils'

import { createBaseExtensions } from './extensions'
import { linkifyIssueReferences, type RenderIssueHref } from './issue-reference'
import './editor.css'

let schemaExtensions: Extensions | null = null

/**
 * Parses HTML through the editor schema and prints it again. Every tag,
 * attribute and URL scheme the schema does not know is dropped, so the
 * result is safe for `dangerouslySetInnerHTML`. Browser only (uses DOMParser).
 */
export function sanitizeRichTextHtml(html: string): string {
  if (!html.trim()) return ''
  schemaExtensions ??= createBaseExtensions()
  return generateHTML(generateJSON(html, schemaExtensions), schemaExtensions)
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
}

/** Server fallback: the text of the HTML, one line per block. React escapes it. */
export function richTextToPlainText(html: string): string {
  return html
    .replace(/<\/(p|h[1-6]|li|blockquote|pre)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, entity => ENTITIES[entity] ?? entity)
    .trim()
}

const subscribeNever = () => () => undefined

export interface RichTextContentProps {
  /** HTML produced by `RichTextEditor`. Untrusted input is fine: it is sanitized. */
  html: string
  className?: string
  /** Turns issue identifiers such as `ENG-123` into links. */
  renderIssueHref?: RenderIssueHref
  /** Called on a click on an issue link. Call `event.preventDefault()` to do client routing. */
  onIssueClick?: (identifier: string, event: MouseEvent<HTMLDivElement>) => void
}

/** Read-only renderer with the same typography as the editor. */
export function RichTextContent({
  html,
  className,
  renderIssueHref,
  onIssueClick,
}: RichTextContentProps) {
  const isClient = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  )
  const safeHtml = useMemo(
    () => (isClient ? linkifyIssueReferences(sanitizeRichTextHtml(html), renderIssueHref) : null),
    [isClient, html, renderIssueHref]
  )

  const classes = cn('rte-root rte-prose', className)

  if (safeHtml === null) {
    return <div className={cn(classes, 'whitespace-pre-line')}>{richTextToPlainText(html)}</div>
  }

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onIssueClick || !(event.target instanceof Element)) return
    const anchor = event.target.closest<HTMLAnchorElement>('a[data-issue-ref]')
    const identifier = anchor?.dataset.issueRef
    if (identifier) onIssueClick(identifier, event)
  }

  return (
    // The click handler only delegates clicks on the links inside the HTML.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className={classes} onClick={onClick} dangerouslySetInnerHTML={{ __html: safeHtml }} />
  )
}
