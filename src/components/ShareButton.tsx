import { useEffect, useState } from 'react'
import { canUseShareSheet, shareText, type ShareOutcome } from '../share/shareText'

export interface ShareContent {
  text: string
  title?: string
  url?: string
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
export function ShareButton({ label, getContent, disabled = false }: Props) {
  const [status, setStatus] = useState<string | null>(null)
  // Read once: whether the browser has a share sheet doesn't change.
  const [useSheet] = useState(canUseShareSheet)

  useEffect(() => {
    if (!status) return
    const timer = setTimeout(() => setStatus(null), STATUS_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [status])

  function handleClick() {
    const { text, title, url } = getContent()
    void shareText(text, { title, url }).then(outcome => setStatus(STATUS_TEXT[outcome] ?? null))
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="text-sm font-medium text-teal-700 border border-teal-200 rounded px-3 py-1.5 min-h-[44px] hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {useSheet ? `Share ${label}` : `Copy ${label}`}
      </button>
      <span role="status" className="text-xs text-gray-500">
        {status}
      </span>
    </div>
  )
}
