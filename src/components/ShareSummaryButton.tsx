import { useEffect, useState } from 'react'
import type { BillState } from '../types'
import type { BillBreakdown, Transaction } from '../utils/calculate'
import { buildShareData } from '../share/shareData'
import { toSummaryTemplateData } from '../share/summary/templateData'
import { ShareButton } from './ShareButton'
import { canUseShareSheet } from '../share/shareText'

type SummaryModules = {
  summary: typeof import('../share/summary/renderSummary')
  link: typeof import('../share/link/billLink')
}

// Both load in the background, so the template engine and the link encoder
// stay out of the main bundle.
function loadModules(): Promise<SummaryModules> {
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
 * Shares a plain-text summary of who owes what, ready to paste into a group
 * chat. The text comes from a template (see src/share/summary/).
 *
 * It shares plain text through the share sheet. Where there's no share
 * sheet it copies instead, and the clipboard also gets a rich-text version
 * (title and total in bold) for apps that keep formatting on paste.
 *
 * The text ends with a link that opens the bill in the app (see
 * src/share/link/).
 *
 * The template engine and link encoder are loaded in the background when
 * this mounts, so they stay out of the main bundle. The button is disabled
 * until they've loaded, because the text has to be ready on the tap itself
 * (see ShareButton).
 */
export function ShareSummaryButton({ state, breakdown, transactions }: Props) {
  const [renderer, setRenderer] = useState<SummaryModules | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  // The share sheet only takes plain text, so the rich version is only
  // worth rendering when the button copies.
  const [copies] = useState(() => !canUseShareSheet())

  useEffect(() => {
    let active = true
    loadModules().then(
      mod => { if (active) setRenderer(mod) },
      // If the chunk can't be fetched (for example offline after a new
      // deploy), the button stays disabled and says how to recover; the rest
      // of the app still works.
      () => { if (active) setLoadFailed(true) },
    )
    return () => { active = false }
  }, [])

  function getContent() {
    if (!renderer) throw new Error('Summary renderer is not loaded yet')
    // The link goes inside the text, at the end, rather than in the share
    // sheet's separate URL field, so it appears once and where the template
    // puts it.
    const data = toSummaryTemplateData(
      buildShareData(state, breakdown, transactions),
      renderer.link.billLinkUrl(state),
    )
    return {
      title: data.name || 'Bill split',
      text: renderer.summary.renderSummary(data),
      html: copies ? renderer.summary.renderSummaryHtml(data) : undefined,
    }
  }

  return (
    <>
      <ShareButton label="summary" getContent={getContent} disabled={!renderer} />
      {loadFailed && <span className="text-xs text-gray-500 self-center">Reload the page to share the summary.</span>}
    </>
  )
}
