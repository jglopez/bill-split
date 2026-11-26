import type { BillState } from '../types'
import { billShareTitle } from '../share/shareData'
import { useLinkEncoder } from '../hooks/useLinkEncoder'
import { ShareButton, type ShareContent } from './ShareButton'

interface Props {
  state: BillState
}

/**
 * The share icon on the "Bill total" card. It sends the bare link to the
 * bill, with the same title as the "Share link" button and no other wording:
 * opening any link without a person marker lands on the bill total card (see
 * SummarySection), so the plain link already points where this card is. The
 * title shows in the share sheet; the message itself, and what a copy puts on
 * the clipboard, is just the URL.
 */
export function ShareBillTotalButton({ state }: Props) {
  const link = useLinkEncoder()

  function getContent(): ShareContent {
    if (!link) throw new Error('Link encoder is not loaded yet')
    return { text: '', title: billShareTitle(state.name), url: link.billLinkUrl(state) }
  }

  return <ShareButton variant="icon" label="link to the bill total" getContent={getContent} disabled={!link} />
}
