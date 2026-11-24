import { useEffect, useState } from 'react'
import type { BillState } from '../types'
import type { BillBreakdown, Transaction } from '../utils/calculate'
import { buildShareData } from '../share/shareData'
import { toSummaryTemplateData } from '../share/summary/templateData'
import { ShareButton } from './ShareButton'

type SummaryModule = typeof import('../share/summary/renderSummary')

interface Props {
  state: BillState
  breakdown: BillBreakdown
  transactions: Transaction[]
}

/**
 * Shares a plain-text summary of who owes what, ready to paste into a group
 * chat. The text comes from a template (see src/share/summary/). Copying
 * also puts a rich-text version on the clipboard, with the title and total
 * in bold, for apps that keep formatting on paste; the share sheet only
 * carries plain text, so a separate Copy button is offered beside it.
 *
 * The template engine is loaded in the background when this mounts, so it
 * stays out of the main bundle. The button is disabled until it's loaded,
 * because the text has to be ready on the tap itself (see ShareButton).
 */
export function ShareSummaryButton({ state, breakdown, transactions }: Props) {
  const [renderer, setRenderer] = useState<SummaryModule | null>(null)

  useEffect(() => {
    let active = true
    import('../share/summary/renderSummary').then(
      mod => { if (active) setRenderer(mod) },
      // If the chunk can't be fetched (for example offline after a new
      // deploy), the button stays disabled; the rest of the app still works.
      () => {},
    )
    return () => { active = false }
  }, [])

  function getContent() {
    if (!renderer) throw new Error('Summary renderer is not loaded yet')
    const data = toSummaryTemplateData(buildShareData(state, breakdown, transactions))
    return {
      title: data.name || 'Bill split',
      text: renderer.renderSummary(data),
      html: renderer.renderSummaryHtml(data),
    }
  }

  return <ShareButton label="summary" getContent={getContent} disabled={!renderer} alsoCopy />
}
