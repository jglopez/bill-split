import type { IncomingLink } from '../share/link/incoming'
import { refreshCachedPage } from '../lib/refreshCachedPage'
import { ConfirmModal } from './ConfirmModal'

interface Props {
  incoming: IncomingLink
  onOpen: () => void
  onDismiss: () => void
}

// Reloading keeps the link in the address bar, so the updated app opens it.
function reload() {
  void refreshCachedPage().then(() => window.location.reload())
}

/**
 * What the app says about a bill link it was opened with: a confirmation
 * before a shared bill replaces the current one, or why the link couldn't
 * be opened.
 */
export function SharedBillNotice({ incoming, onOpen, onDismiss }: Props) {
  if (incoming.kind === 'bill') {
    const name = incoming.bill.name.trim()
    return (
      <ConfirmModal
        title="Open the shared bill?"
        message={`${name ? `“${name}” will replace` : 'It will replace'} the bill you have now. Your current bill can't be recovered.`}
        confirmLabel="Open shared bill"
        cancelLabel="Keep mine"
        onConfirm={onOpen}
        onCancel={onDismiss}
      />
    )
  }

  const message = {
    newer: 'This bill link was made with a newer version of Bill Split. Update to open it.',
    malformed: "This bill link is incomplete or damaged, so it couldn't be opened. Ask for it to be sent again.",
    unavailable: "Couldn't load what's needed to open this bill link. Check your connection, then reload.",
  }[incoming.kind]
  const action = { newer: 'Update', malformed: null, unavailable: 'Reload' }[incoming.kind]

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800"
    >
      <span>{message}</span>
      <span className="flex items-center gap-3">
        {action && (
          <button onClick={reload} className="font-medium underline focus:outline-none focus:ring-2 focus:ring-amber-500 rounded">
            {action}
          </button>
        )}
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-amber-600 hover:text-amber-800 focus:outline-none font-medium"
        >
          ×
        </button>
      </span>
    </div>
  )
}
