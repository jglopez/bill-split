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
  const { title, url } = opts

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

  return copyText(url ? `${text}\n\n${url}` : text)
}

async function copyText(text: string): Promise<ShareOutcome> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return 'failed'
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
