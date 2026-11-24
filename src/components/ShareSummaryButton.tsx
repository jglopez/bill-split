import { useEffect, useState } from 'react'
import type { BillState } from '../types'
import type { BillBreakdown, Transaction } from '../utils/calculate'
import { buildShareData } from '../share/shareData'
import { toSummaryTemplateData } from '../share/summary/templateData'
import { ShareButton } from './ShareButton'

type RenderSummary = typeof import('../share/summary/renderSummary').renderSummary

interface Props {
  state: BillState
  breakdown: BillBreakdown
  transactions: Transaction[]
}

/**
 * Shares a plain-text summary of who owes what, ready to paste into a group
 * chat. The text comes from a template (see src/share/summary/).
 *
 * The template engine is loaded in the background when this mounts, so it
 * stays out of the main bundle. The button is disabled until it's loaded,
 * because the text has to be ready on the tap itself (see ShareButton).
 */
export function ShareSummaryButton({ state, breakdown, transactions }: Props) {
  const [render, setRender] = useState<RenderSummary | null>(null)

  useEffect(() => {
    let active = true
    import('../share/summary/renderSummary').then(
      mod => { if (active) setRender(() => mod.renderSummary) },
      // If the chunk can't be fetched (for example offline after a new
      // deploy), the button stays disabled; the rest of the app still works.
      () => {},
    )
    return () => { active = false }
  }, [])

  function getContent() {
    if (!render) throw new Error('Summary renderer is not loaded yet')
    const data = toSummaryTemplateData(buildShareData(state, breakdown, transactions))
    return { title: data.name || 'Bill split', text: render(data) }
  }

  return <ShareButton label="summary" getContent={getContent} disabled={!render} />
}
