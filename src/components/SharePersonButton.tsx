import { useEffect, useState } from 'react'
import type { BillState, Participant } from '../types'
import { formatMoney } from '../utils/format'
import { ShareButton, type ShareContent } from './ShareButton'

type LinkModule = typeof import('../share/link/billLink')

interface Props {
  state: BillState
  participant: Participant
  /** What this person owes in total, as shown on their card. */
  total: number
}

/**
 * The text that goes with a link to one person's receipt. Kept apart from
 * the button so the wording is easy to test and change.
 */
export function personShareContent(billName: string, personName: string, total: number, url: string): ShareContent {
  const bill = billName.trim()
  const person = personName.trim()
  const owner = person ? `${person}'s` : 'Your'
  return {
    title: [bill || 'Bill split', person].filter(Boolean).join(': '),
    text: bill ? `${owner} share of ${bill}: ${formatMoney(total)}` : `${owner} share: ${formatMoney(total)}`,
    url,
  }
}

/**
 * The share icon on a person's receipt card. It sends a link that opens the
 * bill and scrolls straight to this person's card (see personLinkUrl), with
 * a line saying what they owe. Where there's no share sheet it copies the
 * same thing instead.
 *
 * The link encoder loads in the background when this mounts, and the icon
 * stays disabled until it has, because the link has to be built during the
 * tap itself (see ShareButton).
 */
export function SharePersonButton({ state, participant, total }: Props) {
  const [link, setLink] = useState<LinkModule | null>(null)

  useEffect(() => {
    let active = true
    // If the chunk can't be fetched the icon just stays disabled; the bill
    // share buttons at the bottom already say to reload.
    import('../share/link/billLink').then(mod => { if (active) setLink(mod) }, () => {})
    return () => { active = false }
  }, [])

  function getContent(): ShareContent {
    if (!link) throw new Error('Link encoder is not loaded yet')
    return personShareContent(state.name, participant.name, total, link.personLinkUrl(state, participant.id))
  }

  const who = participant.name.trim() || 'this person'
  return (
    <ShareButton
      variant="icon"
      label={`link to ${who}'s receipt`}
      getContent={getContent}
      disabled={!link}
    />
  )
}
