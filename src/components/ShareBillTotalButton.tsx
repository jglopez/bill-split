import type { BillState } from '../types'
import { useLinkEncoder } from '../hooks/useLinkEncoder'
import { ShareButton, type ShareContent } from './ShareButton'

interface Props {
  state: BillState
}

/**
 * The share icon on the "Bill total" card. It sends the bare link to the
 * bill, with no wording around it: opening any link without a person marker
 * lands on the bill total card (see SummarySection), so the plain link
 * already points where this card is. The share sheet or clipboard gets just
 * the URL.
 */
export function ShareBillTotalButton({ state }: Props) {
  const link = useLinkEncoder()

  function getContent(): ShareContent {
    if (!link) throw new Error('Link encoder is not loaded yet')
    return { text: '', url: link.billLinkUrl(state) }
  }

  return <ShareButton variant="icon" label="link to the bill total" getContent={getContent} disabled={!link} />
}
