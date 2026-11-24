import { useEffect, useState } from 'react'
import { canUseShareSheet, copyText, shareText, type ShareOutcome } from '../share/shareText'

export interface ShareContent {
  text: string
  title?: string
  url?: string
  /** The same content as rich text, used only when copying (see shareText). */
  html?: string
}

interface Props {
  /** Names what gets shared, in lowercase after "Share" or "Copy", for example "summary". */
  label: string
  /**
   * Returns what to share. Called synchronously on click, so it must not
   * await anything: iOS only opens the share sheet during the tap itself.
   * Prepare slow work (such as loading a template engine) ahead of time and
   * pass `disabled` until it's ready.
   */
  getContent: () => ShareContent
  disabled?: boolean
  /**
   * Also offer a plain "Copy" button where the share sheet is used, for
   * content whose copy is richer than what the share sheet can carry (for
   * example bold text). Without a share sheet the main button already copies.
   */
  alsoCopy?: boolean
}

// How long a "Copied" or error note stays visible.
const STATUS_TIMEOUT_MS = 4000

const STATUS_TEXT: Partial<Record<ShareOutcome, string>> = {
  copied: 'Copied to clipboard',
  failed: "Couldn't share or copy",
}

/**
 * One share action. Opens the OS share sheet where there is one (phones,
 * and most desktop Safari and Chrome), and copies to the clipboard
 * otherwise. The button says which it will do.
 */
export function ShareButton({ label, getContent, disabled = false, alsoCopy = false }: Props) {
  const [status, setStatus] = useState<string | null>(null)
  // Read once: whether the browser has a share sheet doesn't change.
  const [useSheet] = useState(canUseShareSheet)

  useEffect(() => {
    if (!status) return
    const timer = setTimeout(() => setStatus(null), STATUS_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [status])

  function report(outcome: ShareOutcome) {
    setStatus(STATUS_TEXT[outcome] ?? null)
  }

  function handleClick() {
    const { text, title, url, html } = getContent()
    void shareText(text, { title, url, html }).then(report)
  }

  function handleCopy() {
    const { text, url, html } = getContent()
    void copyText(text, { url, html }).then(report)
  }

  const buttonClass = 'text-sm font-medium text-teal-700 border border-teal-200 rounded px-3 py-1.5 min-h-[44px] hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={handleClick} disabled={disabled} className={buttonClass}>
        {useSheet ? `Share ${label}` : `Copy ${label}`}
      </button>
      {alsoCopy && useSheet && (
        <button
          type="button"
          onClick={handleCopy}
          disabled={disabled}
          aria-label={`Copy ${label}`}
          className={buttonClass}
        >
          Copy
        </button>
      )}
      <span role="status" className="text-xs text-gray-500">
        {status}
      </span>
    </div>
  )
}
