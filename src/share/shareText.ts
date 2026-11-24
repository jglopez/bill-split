// Sends text out of the app: the OS share sheet where the browser has one,
// the clipboard otherwise. Every share method (summary text, links, exports)
// goes through here so they all behave the same way.
//
// Call it synchronously from a click or tap handler. iOS Safari only opens
// the share sheet, and only allows clipboard writes, during a user gesture,
// so build the text before the click rather than after an await.

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

export interface ShareTextOptions {
  title?: string
  url?: string
  /**
   * The same content as rich text (an HTML fragment), for apps that keep
   * formatting on paste. Only the clipboard can carry it; the share sheet
   * gets the plain text.
   */
  html?: string
}

/** True when the browser can open the OS share sheet for text. */
export function canUseShareSheet(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false
  // canShare is missing on some browsers that do support share(); treat a
  // missing canShare as "probably yes" and let share() report otherwise.
  if (typeof navigator.canShare !== 'function') return true
  return navigator.canShare({ text: 'x' })
}

/**
 * Share text through the OS share sheet, or copy it to the clipboard when
 * there's no share sheet. The URL, when given, goes in its own share field so
 * apps can show it as a link; when copying, it's appended to the text.
 *
 * Resolves to what happened; never rejects.
 */
export async function shareText(text: string, opts: ShareTextOptions = {}): Promise<ShareOutcome> {
  const { title, url, html } = opts

  if (canUseShareSheet()) {
    const data: ShareData = { text }
    if (title) data.title = title
    if (url) data.url = url
    try {
      await navigator.share(data)
      return 'shared'
    } catch (err) {
      // AbortError: the user closed the share sheet without picking a target.
      // InvalidStateError: a share sheet is already open (for example a second
      // click on desktop). Neither is a failure, and neither should copy.
      if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'InvalidStateError')) {
        return 'cancelled'
      }
      // Anything else is a last-chance clipboard attempt. It often fails too,
      // because the same expired gesture usually blocks the clipboard, and
      // then the caller reports 'failed'.
    }
  }

  return copyText(text, { url, html })
}

/**
 * Copy to the clipboard without trying the share sheet. With `html`, the
 * clipboard gets both rich text and plain text, and the app pasted into
 * picks the one it supports; browsers without rich clipboard support get
 * the plain text. Like shareText, call it synchronously from a click.
 */
export async function copyText(
  text: string,
  opts: Pick<ShareTextOptions, 'url' | 'html'> = {},
): Promise<ShareOutcome> {
  const { url, html } = opts
  const plain = url ? `${text}\n\n${url}` : text
  if (typeof navigator === 'undefined' || !navigator.clipboard) return 'failed'

  if (html && typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard.write === 'function') {
    const richHtml = url ? `${html}<br><br><a href="${escapeAttribute(url)}">${escapeText(url)}</a>` : html
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([plain], { type: 'text/plain' }),
          'text/html': new Blob([richHtml], { type: 'text/html' }),
        }),
      ])
      return 'copied'
    } catch {
      // Some browsers refuse rich clipboard items; plain text still helps.
    }
  }

  if (!navigator.clipboard.writeText) return 'failed'
  try {
    await navigator.clipboard.writeText(plain)
    return 'copied'
  } catch {
    return 'failed'
  }
}

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttribute(text: string): string {
  return escapeText(text).replace(/"/g, '&quot;')
}
