import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BillState } from '../types'
import { SharePersonButton, personShareContent } from './SharePersonButton'
import { readIncomingLink } from '../share/link/incoming'

const bill: BillState = {
  name: 'Friday dinner',
  participants: [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }],
  items: [{ id: 'i', name: 'Pizza', price: '20', assignedTo: null }],
  tax: '',
  tip: '',
  tipBase: 'pre-tax',
  tipDiscountBase: 'pre-discount',
  tipFeeBase: 'pre-fee',
  additionalFees: [],
  payerMode: 'single',
  singlePayerId: 'a',
  amountPaid: {},
}

afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>).share
})

describe('personShareContent', () => {
  it('names the bill and the person, with what they owe', () => {
    expect(personShareContent('Friday dinner', 'Bob', 12.5, 'https://x.test/')).toEqual({
      title: 'Friday dinner: Bob',
      text: "Bob's share of Friday dinner: $12.50",
      url: 'https://x.test/',
    })
  })

  it('reads naturally without a bill name', () => {
    expect(personShareContent('  ', 'Bob', 3, 'u')).toMatchObject({ title: 'Bill split: Bob', text: "Bob's share: $3.00" })
  })

  it('reads naturally without a person name', () => {
    expect(personShareContent('Lunch', '', 3, 'u')).toMatchObject({ title: 'Lunch', text: 'Your share of Lunch: $3.00' })
  })
})

describe('SharePersonButton', () => {
  it('shares a link that opens the bill pointed at this person', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })
    render(<SharePersonButton state={bill} participant={bill.participants[1]} total={10} />)

    const button = screen.getByRole('button', { name: "Share link to Bob's receipt" })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)

    expect(share).toHaveBeenCalledTimes(1)
    const { url, title, text } = share.mock.calls[0][0] as ShareData
    expect(title).toBe('Friday dinner: Bob')
    expect(text).toBe("Bob's share of Friday dinner: $10.00")
    const link = await readIncomingLink(new URL(url!).hash)
    if (link?.kind !== 'bill') throw new Error('expected a bill link')
    expect(link.bill.participants.find(p => p.id === link.personId)?.name).toBe('Bob')
  })
})
