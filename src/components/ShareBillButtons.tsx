import { useEffect, useState } from 'react'
import type { BillState } from '../types'
import type { BillBreakdown, Transaction } from '../utils/calculate'
import { buildShareData } from '../share/shareData'
import { toSummaryTemplateData } from '../share/summary/templateData'
import { ShareButton } from './ShareButton'

type ShareModules = {
  summary: typeof import('../share/summary/renderSummary')
  link: typeof import('../share/link/billLink')
}

// Both load in the background, so the template engine and the link encoder
// stay out of the main bundle.
function loadModules(): Promise<ShareModules> {
  return Promise.all([
    import('../share/summary/renderSummary'),
    import('../share/link/billLink'),
  ]).then(([summary, link]) => ({ summary, link }))
}

interface Props {
  state: BillState
  breakdown: BillBreakdown
  transactions: Transaction[]
}

/**
 * The two ways to send a bill, side by side:
 *
 * - "Copy summary", the main button, copies who owes what (from the
 *   template in src/share/summary/) ending with the bill link. It always
 *   copies rather than opening the share sheet, because only the clipboard
 *   carries rich text: apps that keep formatting on paste show the bold
 *   and italic parts, and the rest get the same text without any markup.
 * - "Share link", the smaller one, sends only the bill link through the
 *   share sheet ("Copy link" where there's no share sheet).
 *
 * The template engine and link encoder are loaded in the background when
 * this mounts. Both buttons stay disabled until they've loaded, because
 * the content has to be ready on the tap itself (see ShareButton).
 */
export function ShareBillButtons({ state, breakdown, transactions }: Props) {
  const [modules, setModules] = useState<ShareModules | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let active = true
    loadModules().then(
      mod => { if (active) setModules(mod) },
      // If the chunk can't be fetched (for example offline after a new
      // deploy), the buttons stay disabled and say how to recover; the rest
      // of the app still works.
      () => { if (active) setLoadFailed(true) },
    )
    return () => { active = false }
  }, [])

  function summaryContent() {
    if (!modules) throw new Error('Share modules are not loaded yet')
    // The link goes inside the text, at the end, so it appears once and
    // where the template puts it.
    const data = toSummaryTemplateData(
      buildShareData(state, breakdown, transactions),
      modules.link.billLinkUrl(state),
    )
    // No title: copying has nowhere to put one.
    return {
      text: modules.summary.renderSummary(data),
      html: modules.summary.renderSummaryHtml(data),
    }
  }

  function linkContent() {
    if (!modules) throw new Error('Share modules are not loaded yet')
    // The bill name titles the share for targets that use one (such as an
    // email subject); the message itself is just the link.
    const { name } = buildShareData(state, breakdown, transactions)
    return { text: '', title: name || 'Bill split', url: modules.link.billLinkUrl(state) }
  }

  return (
    <>
      <ShareButton
        label="summary"
        action="copy"
        variant="primary"
        getContent={summaryContent}
        disabled={!modules}
      />
      <ShareButton label="link" getContent={linkContent} disabled={!modules} />
      {loadFailed && (
        <p className="basis-full text-xs text-gray-500">Reload the page to share this bill.</p>
      )}
    </>
  )
}
