import { useEffect, useState } from 'react'
import { canUseShareSheet, copyText, shareText, type ShareOutcome } from '../share/shareText'
import CheckIcon from './icons/check.svg?react'
import LinkIcon from './icons/link.svg?react'
import ShareIcon from './icons/share.svg?react'

export interface ShareContent {
  /** The text to send. Empty when only `url` is shared. */
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
   * `share` (the default) opens the share sheet where there is one and
   * copies otherwise. `copy` always copies, so rich text (`html`) reaches
   * the clipboard even on phones, where the share sheet only takes plain
   * text.
   */
  action?: 'share' | 'copy'
  /**
   * `primary` is the filled main action that grows to fill its row;
   * `secondary` (the default) is the smaller outlined one beside it.
   * `icon` is a small glyph with a full-size tap target, for actions on a
   * single card; its label is its accessible name instead of visible text.
   */
  variant?: 'primary' | 'secondary' | 'icon'
}

// How long the button shows "Copied!" or an error before its label returns.
export const STATUS_TIMEOUT_MS = 2000

const VARIANT_CLASS = {
  primary:
    'flex-1 bg-teal-600 text-white border border-teal-600 hover:bg-teal-700 hover:border-teal-700',
  secondary: 'text-teal-700 bg-white border border-teal-200 hover:bg-teal-50',
}

/**
 * One share action. By default it opens the OS share sheet where there is
 * one (phones, and most desktop Safari and Chrome) and copies to the
 * clipboard otherwise; the button says which it will do. With
 * `action="copy"` it always copies.
 *
 * After a copy, or when something fails, the button's own label briefly
 * says what happened, so the outcome shows even in a tight row of buttons.
 * A hidden status region announces the same thing to screen readers.
 */
export function ShareButton({
  label,
  getContent,
  disabled = false,
  action = 'share',
  variant = 'secondary',
}: Props) {
  // `seq` changes on every outcome, so repeating the same message restarts
  // its timer instead of letting the earlier one clear it early.
  const [status, setStatus] = useState<{ text: string; seq: number } | null>(null)
  // True while a share or copy is in progress, so a second click can't start
  // another one (a desktop share popover stays open until it's dismissed).
  const [busy, setBusy] = useState(false)
  // Read once: whether the browser has a share sheet doesn't change.
  const [useSheet] = useState(() => action === 'share' && canUseShareSheet())

  useEffect(() => {
    if (!status) return
    const timer = setTimeout(() => setStatus(null), STATUS_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [status])

  function report(outcome: ShareOutcome) {
    const text =
      outcome === 'copied' ? 'Copied!'
      : outcome === 'failed' ? (useSheet ? "Couldn't share" : "Couldn't copy")
      : null
    setStatus(prev => (text ? { text, seq: (prev?.seq ?? 0) + 1 } : null))
  }

  function handleClick() {
    if (busy) return
    let content: ShareContent
    try {
      content = getContent()
    } catch (err) {
      // A bill the share method can't render (for example amounts that
      // aren't finite numbers) must say so rather than silently do nothing.
      console.error('Could not prepare share content', err)
      report('failed')
      return
    }
    setBusy(true)
    const sent = action === 'copy'
      ? copyText(content.text, { url: content.url, html: content.html })
      : shareText(content.text, { title: content.title, url: content.url, html: content.html })
    void sent.then(report).finally(() => setBusy(false))
  }

  const name = useSheet ? `Share ${label}` : `Copy ${label}`

  if (variant === 'icon') {
    const Icon = useSheet ? ShareIcon : LinkIcon
    const copied = status?.text === 'Copied!'
    return (
      <span className="relative inline-flex">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled || busy}
          aria-label={name}
          title={name}
          className="inline-flex items-center justify-center w-11 h-11 rounded-full text-gray-400 hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {copied
            ? <CheckIcon aria-hidden="true" className="w-3 h-3 text-teal-700" />
            : <Icon aria-hidden="true" className="w-4 h-4" />}
        </button>
        {/* Too little room for the outcome inside an icon, so it shows beside it. */}
        {status && !copied && (
          <span aria-hidden="true" className="absolute right-full top-1/2 -translate-y-1/2 mr-1 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white">
            {status.text}
          </span>
        )}
        <span role="status" className="sr-only">
          {status?.text}
        </span>
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || busy}
        className={`text-sm font-medium rounded px-4 py-1.5 min-h-[44px] whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASS[variant]}`}
      >
        {status?.text ?? name}
      </button>
      <span role="status" className="sr-only">
        {status?.text}
      </span>
    </>
  )
}
