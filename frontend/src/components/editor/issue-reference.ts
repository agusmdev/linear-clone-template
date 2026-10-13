import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/** Builds the link target for an issue identifier such as `ENG-123`. Return null to skip it. */
export type RenderIssueHref = (identifier: string) => string | null | undefined

/** Matches issue identifiers: 2-5 capital letters, a dash, digits (`ENG-123`). */
export const ISSUE_IDENTIFIER_SOURCE = '\\b[A-Z]{2,5}-\\d+\\b'

export interface IssueIdentifierMatch {
  identifier: string
  index: number
}

export function findIssueIdentifiers(text: string): IssueIdentifierMatch[] {
  const matches: IssueIdentifierMatch[] = []
  for (const match of text.matchAll(new RegExp(ISSUE_IDENTIFIER_SOURCE, 'g'))) {
    matches.push({ identifier: match[0], index: match.index })
  }
  return matches
}

export const issueReferencePluginKey = new PluginKey<DecorationSet>('issueReference')

function buildDecorations(doc: ProseMirrorNode, renderHref: RenderIssueHref | undefined) {
  if (!renderHref) return DecorationSet.empty
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.spec.code) return false
    if (!node.isText || !node.text) return true
    if (node.marks.some(mark => mark.type.spec.code || mark.type.name === 'link')) return false
    for (const { identifier, index } of findIssueIdentifiers(node.text)) {
      const href = renderHref(identifier)
      if (!href) continue
      decorations.push(
        Decoration.inline(pos + index, pos + index + identifier.length, {
          nodeName: 'a',
          href,
          class: 'rte-issue-ref',
          'data-issue-ref': identifier,
        })
      )
    }
    return false
  })
  return DecorationSet.create(doc, decorations)
}

export interface IssueReferenceOptions {
  /** Read on every document change, so the caller can keep the newest function in a ref. */
  getRenderIssueHref: () => RenderIssueHref | undefined
}

/**
 * Shows issue identifiers as links with a decoration. The stored HTML does not
 * change: the link exists only in the view. Dispatch a transaction with
 * `setMeta(issueReferencePluginKey, true)` to rebuild after the href function changes.
 */
export const IssueReference = Extension.create<IssueReferenceOptions>({
  name: 'issueReference',

  addOptions() {
    return { getRenderIssueHref: () => undefined }
  },

  addProseMirrorPlugins() {
    const { getRenderIssueHref } = this.options
    return [
      new Plugin<DecorationSet>({
        key: issueReferencePluginKey,
        state: {
          init: (_config, state) => buildDecorations(state.doc, getRenderIssueHref()),
          apply: (tr, previous, _oldState, newState) =>
            tr.docChanged || tr.getMeta(issueReferencePluginKey)
              ? buildDecorations(newState.doc, getRenderIssueHref())
              : previous,
        },
        props: {
          decorations: state => issueReferencePluginKey.getState(state),
        },
      }),
    ]
  },
})

const SKIPPED_TAGS = new Set(['a', 'code', 'pre'])

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Wraps issue identifiers found in HTML text (outside links and code) in `<a>` tags. */
export function linkifyIssueReferences(html: string, renderHref?: RenderIssueHref): string {
  if (!renderHref || !html) return html
  let skipDepth = 0
  return html
    .split(/(<[^>]*>)/g)
    .map(part => {
      if (part.startsWith('<')) {
        const tag = /^<(\/?)([a-zA-Z0-9]+)/.exec(part)
        if (tag && SKIPPED_TAGS.has(tag[2].toLowerCase())) {
          skipDepth = Math.max(0, skipDepth + (tag[1] ? -1 : 1))
        }
        return part
      }
      if (skipDepth > 0 || !part) return part
      return part.replace(new RegExp(ISSUE_IDENTIFIER_SOURCE, 'g'), identifier => {
        const href = renderHref(identifier)
        if (!href) return identifier
        return `<a href="${escapeAttribute(href)}" class="rte-issue-ref" data-issue-ref="${identifier}">${identifier}</a>`
      })
    })
    .join('')
}
