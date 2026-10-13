# Rich text editor

A Linear-style rich text editor built on TipTap 3, plus a read-only renderer and an autosave hook.
Everything here is data-agnostic: props in, callbacks out, no fetching.

```ts
import { RichTextEditor, RichTextContent, useDebouncedAutosave } from '@/components/editor'
```

## `<RichTextEditor />`

| Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | `string` | required | HTML. An empty document is `''`. |
| `onChange` | `(html: string) => void` | – | Called on every change. Empty document gives `''`. |
| `onBlur` | `(html: string) => void` | – | Called with the current HTML on blur. |
| `placeholder` | `string` | `'Add description…'` | Shown while empty. Read once, on mount. |
| `editable` | `boolean` | `true` | Can change at any time. |
| `autofocus` | `boolean` | `false` | Puts the cursor at the end on mount. |
| `className` | `string` | – | On the wrapper. |
| `ariaLabel` | `string` | `'Rich text editor'` | Accessible name of the text box. |
| `renderIssueHref` | `(identifier: string) => string \| null \| undefined` | – | Shows `ENG-123`-style text as a link. Return `null` to skip one. |
| `onIssueClick` | `(identifier: string, event: MouseEvent) => void` | – | Click on an issue link (use it for client routing). |

Features:

- Headings 1-3, bold, italic, strike, inline code, bullet / numbered / task lists, quote, code block, divider, link.
- Markdown input rules: `# `, `## `, `### `, `- `, `1. `, `[ ] `, `> `, ```` ``` ````, `---`, `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``.
- Links: typed and pasted URLs become links. Paste a URL on selected text to link it. Mod+click opens a link in a new tab.
- Slash menu: type `/` at the start of a line or after a space. Type to filter, ↑/↓ to move, Enter or Tab to insert, Esc to close.
- Bubble toolbar on a text selection: H1-H3, bold, italic, strike, code, link (inline URL input; empty URL removes the link).
- Issue identifiers (`/\b[A-Z]{2,5}-\d+\b/`) are shown as links with a decoration. The stored HTML does not change. Text in code and inside existing links is skipped.

SSR: the editor uses `immediatelyRender: false`. The server and the first client render show `RichTextContent` (plain text on the server), then the editor mounts.

Controlled value: changes to `value` from outside are applied when the editor does not have focus. While the user types, the editor is the source of truth.

```tsx
const [html, setHtml] = useState(issue.description ?? '')
const { status } = useDebouncedAutosave(html, (next, { keepalive }) =>
  updateIssue.mutateAsync({ data: { description: next }, keepalive })
)

<RichTextEditor
  value={html}
  onChange={setHtml}
  placeholder="Add description…"
  renderIssueHref={(id) => `/issue/${id}`}
  onIssueClick={(id, event) => {
    event.preventDefault()
    void navigate({ to: '/issue/$identifier', params: { identifier: id } })
  }}
/>
```

## `<RichTextContent />`

Read-only renderer with the same typography.

| Prop | Type | Notes |
|---|---|---|
| `html` | `string` | Sanitized on the client through the editor schema (unknown tags, attributes and `javascript:` URLs are dropped). |
| `className` | `string` | – |
| `renderIssueHref` | `(identifier: string) => string \| null \| undefined` | Turns `ENG-123` text into links. |
| `onIssueClick` | `(identifier, event) => void` | Click on an issue link. |

On the server it renders the plain text of `html` (one line per block), then the rich HTML after hydration.

## `useDebouncedAutosave(value, save, delay = 800)`

Returns `{ status, error, flush }`.

- `status`: `'idle' | 'unsaved' | 'saving' | 'saved' | 'error'`. `'unsaved'` shows as soon as the value changes and lasts until the debounced save starts.
- The first `value` counts as saved. A change is saved after `delay` ms without new changes.
- `save` may return a promise; a rejection sets `status: 'error'` and `error`.
- Only the newest save sets the status. `flush()` saves now (also retries after an error).
- A pending change is saved when the component unmounts.
- A pending change is also saved when the page is hidden, reloaded or closed (`pagehide`,
  `visibilitychange`). Then `save` gets `{ keepalive: true }` as its second argument: pass it to
  the request (`api.patch(url, data, { keepalive })`), or the browser cancels the request.

## Other exports

`createBaseExtensions` (the shared schema), `sanitizeRichTextHtml`, `richTextToPlainText`, `linkifyIssueReferences`, `findIssueIdentifiers`, `ISSUE_IDENTIFIER_SOURCE`, `SLASH_COMMAND_ITEMS`, `filterSlashCommandItems`.

## Styles

`editor.css` is imported by the components. All rules are scoped under `.rte-root`. Colors come from
`--color-background`, `--color-popover`, `--color-border`, `--color-foreground`, `--color-muted-foreground`
and `--color-primary`, with the Linear dark palette as fallback. Base text size is 13px (`--rte-font-size`).

## Files

| File | What |
|---|---|
| `RichTextEditor.tsx` | The editor component |
| `RichTextContent.tsx` | Read-only renderer, sanitizer, plain-text fallback |
| `BubbleToolbar.tsx` | Selection toolbar and link input |
| `SlashMenu.tsx` | Floating slash menu (portal, floating-ui) |
| `slash-command.ts` | Slash items, filter, menu store, TipTap extension |
| `issue-reference.ts` | Issue identifier decoration and HTML linkify |
| `extensions.ts` | Shared TipTap extensions (schema, input rules, placeholder) |
| `useDebouncedAutosave.ts` | Autosave hook |
| `editor.css` | Prose and menu styles |
