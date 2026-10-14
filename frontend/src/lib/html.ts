/** True when rich-text HTML shows no text (e.g. `<p></p><p> </p>` after pressing Enter). */
export function isBlankHtml(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim() === ''
  )
}
