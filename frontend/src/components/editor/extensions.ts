import type { Extensions } from '@tiptap/core'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import { StarterKit } from '@tiptap/starter-kit'

export interface BaseExtensionOptions {
  /** Text shown when the whole document is empty. Omit to turn placeholders off. */
  placeholder?: string
}

/**
 * The document schema shared by the editor and the read-only renderer:
 * headings 1-3, marks, lists, task lists, quote, code block, link, rule.
 * StarterKit also brings the Markdown input rules (`# `, `- `, `1. `, `> `,
 * ```` ``` ````, `---`, `**bold**`, ...). TaskItem adds `[ ] ` / `[x] `.
 */
export function createBaseExtensions({ placeholder }: BaseExtensionOptions = {}): Extensions {
  const extensions: Extensions = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      trailingNode: false,
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
  ]

  if (placeholder !== undefined) {
    extensions.push(
      Placeholder.configure({
        includeChildren: false,
        placeholder: ({ editor, node }) => {
          if (editor.isEmpty) return placeholder
          if (node.type.name === 'heading') return `Heading ${String(node.attrs.level)}`
          if (node.type.name === 'paragraph') return "Type '/' for commands"
          return ''
        },
      })
    )
  }

  return extensions
}
