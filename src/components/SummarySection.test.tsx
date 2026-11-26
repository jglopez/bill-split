import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { readIncomingLink } from '../share/link/incoming'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { FOCUS_HIGHLIGHT_MS, FOCUS_HIGHLIGHT_REDUCED_MOTION_MS, SummarySection } from './SummarySection'
import { calculateBreakdown } from '../utils/calculate'
import { formatAmount } from '../utils/format'
import type { AdditionalFee, BillState, Participant } from '../types'

const alice: Participant = { id: 'a', name: 'Alice' }
const bob: Participant = { id: 'b', name: 'Bob' }

const DEFAULT_WIDTH = window.innerWidth

function setInnerWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
  window.dispatchEvent(new Event('resize'))
}

afterEach(() => {
  setInnerWidth(DEFAULT_WIDTH)
})

function billState(overrides: Partial<BillState> = {}): BillState {
  return {
    name: '',
    participants: [alice, bob],
    items: [{ id: 'i1', name: 'Dinner', price: '10', assignedTo: null }],
    tax: '',
    tip: '',
    tipBase: 'pre-tax',
    tipDiscountBase: 'pre-discount',
    tipFeeBase: 'pre-fee',
    additionalFees: [],
    payerMode: 'single',
    singlePayerId: 'a',
    amountPaid: {},
    ...overrides,
  }
}

describe('SummarySection', () => {
  it('renders nothing when there are no participants', () => {
    const state = billState({ participants: [] })
    const { container } = render(
      <SummarySection
        participants={[]}
        additionalFees={[]}
        state={state}
        breakdown={calculateBreakdown(state)}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the subtotal is zero', () => {
    const state = billState({ items: [] })
    const { container } = render(
      <SummarySection
        participants={[alice, bob]}
        additionalFees={[]}
        state={state}
        breakdown={calculateBreakdown(state)}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a subtotal row and grand total for each participant on desktop', () => {
    const state = billState()
    render(
      <SummarySection
        participants={[alice, bob]}
        additionalFees={[]}
        state={state}
        breakdown={calculateBreakdown(state)}
      />,
    )
    expect(screen.getByText('Subtotal')).toBeInTheDocument()
    expect(screen.getByText('Grand total')).toBeInTheDocument()
    expect(screen.getAllByText('5.00')).toHaveLength(4) // Alice + Bob in both the subtotal and grand total rows
  })

  it('omits tax and tip rows when neither is set', () => {
    const state = billState()
    render(
      <SummarySection
        participants={[alice, bob]}
        additionalFees={[]}
        state={state}
        breakdown={calculateBreakdown(state)}
      />,
    )
    expect(screen.queryByText(/\+ Tax/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\+ Tip/)).not.toBeInTheDocument()
  })

  it('shows tax and tip rows with their amount labels when set', () => {
    const state = billState({ tax: '10%', tip: '20%' })
    render(
      <SummarySection
        participants={[alice, bob]}
        additionalFees={[]}
        state={state}
        breakdown={calculateBreakdown(state)}
      />,
    )
    expect(screen.getByText('+ Tax (10%)')).toBeInTheDocument()
    expect(screen.getByText('+ Tip (20%)')).toBeInTheDocument()
  })

  it('leaves out amounts entered in dollars from the labels on desktop', () => {
    const fees: AdditionalFee[] = [{ id: 'f1', name: 'Service', amount: '3.00', base: 'pre-tax' }]
    const state = billState({ tax: '0.85', tip: '2.00', additionalFees: fees })
    render(
      <SummarySection
        participants={[alice, bob]}
        additionalFees={fees}
        state={state}
        breakdown={calculateBreakdown(state)}
      />,
    )
    expect(screen.getByText('+ Tax')).toBeInTheDocument()
    expect(screen.getByText('+ Tip')).toBeInTheDocument()
    expect(screen.getByText('+ Service')).toBeInTheDocument()
  })

  it('keeps a fee rate and drops the minus sign from a discount rate on desktop', () => {
    const fees: AdditionalFee[] = [
      { id: 'f1', name: 'Service', amount: '18%', base: 'post-tax' },
      { id: 'f2', name: 'Coupon', amount: '-10%', base: 'pre-tax' },
    ]
    const state = billState({ additionalFees: fees })
    render(
      <SummarySection
        participants={[alice, bob]}
        additionalFees={fees}
        state={state}
        breakdown={calculateBreakdown(state)}
      />,
    )
    expect(screen.getByText('+ Service (18%) incl. tax')).toBeInTheDocument()
    expect(screen.getByText('− Coupon (10%)')).toBeInTheDocument()
  })

  it('shows an additional fee row and styles a discount differently from a surcharge', () => {
    const fees: AdditionalFee[] = [
      { id: 'f1', name: 'Service', amount: '10', base: 'pre-tax' },
      { id: 'f2', name: 'Coupon', amount: '-2', base: 'pre-tax' },
    ]
    const state = billState({ additionalFees: fees })
    render(
      <SummarySection
        participants={[alice, bob]}
        additionalFees={fees}
        state={state}
        breakdown={calculateBreakdown(state)}
      />,
    )
    expect(screen.getByText('+ Service')).toHaveClass('text-gray-700')
    expect(screen.getByText('− Coupon')).toHaveClass('text-green-700')
  })

  it('omits a fee row entirely when its total is zero', () => {
    const fees: AdditionalFee[] = [{ id: 'f1', name: 'Service', amount: '', base: 'pre-tax' }]
    const state = billState({ additionalFees: fees })
    render(
      <SummarySection
        participants={[alice, bob]}
        additionalFees={fees}
        state={state}
        breakdown={calculateBreakdown(state)}
      />,
    )
    expect(screen.queryByText(/Service/)).not.toBeInTheDocument()
  })

  it('renders participant cards instead of a table on mobile', () => {
    setInnerWidth(500)
    const state = billState({ tax: '10%' })
    render(
      <SummarySection
        participants={[alice, bob]}
        additionalFees={[]}
        state={state}
        breakdown={calculateBreakdown(state)}
      />,
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getAllByText('Total')).toHaveLength(2)
  })
  it('shows a bill total card above the participant cards on mobile', () => {
    setInnerWidth(500)
    const state = billState({ tax: '10%' })
    render(
      <SummarySection
        participants={[alice, bob]}
        additionalFees={[]}
        state={state}
        breakdown={calculateBreakdown(state)}
      />,
    )
    const cards = screen.getAllByRole('region')
    expect(cards.map(c => c.getAttribute('aria-label'))).toEqual(['Bill total', 'Alice', 'Bob'])
  })

  it('shows bill-level tax, tip, fee and grand total in the mobile bill total card', () => {
    setInnerWidth(500)
    const fees: AdditionalFee[] = [
      { id: 'f1', name: 'Service', amount: '2.00', base: 'pre-tax' },
      { id: 'f2', name: 'Coupon', amount: '-4.00', base: 'pre-tax' },
    ]
    const state = billState({
      items: [{ id: 'i1', name: 'Dinner', price: '40', assignedTo: null }],
      tax: '10%',
      tip: '20%',
      additionalFees: fees,
    })
    const breakdown = calculateBreakdown(state)
    render(
      <SummarySection
        participants={[alice, bob]}
        additionalFees={fees}
        state={state}
        breakdown={breakdown}
      />,
    )
    const billCard = within(screen.getByRole('region', { name: 'Bill total' }))
    expect(billCard.getByText('Subtotal').nextSibling).toHaveTextContent(formatAmount(breakdown.totalSubtotal))
    expect(billCard.getByText('+ Tax (10%)').nextSibling).toHaveTextContent(formatAmount(breakdown.totalTax))
    expect(billCard.getByText('+ Tip (20%)').nextSibling).toHaveTextContent(formatAmount(breakdown.totalTip))
    expect(billCard.getByText('+ Service').nextSibling).toHaveTextContent(
      formatAmount(breakdown.totalAdditionalFees[0]),
    )
    const coupon = billCard.getByText('− Coupon')
    expect(coupon.nextSibling).toHaveTextContent(formatAmount(breakdown.totalAdditionalFees[1]))
    expect(coupon.parentElement).toHaveClass('text-green-700')
    expect(billCard.getByText('Grand total').nextSibling).toHaveTextContent(
      formatAmount(breakdown.totalGrandTotal),
    )
  })
  it('shows only the bill total card on mobile when there is one participant', () => {
    setInnerWidth(500)
    const state = billState({ participants: [alice], tax: '10%' })
    render(
      <SummarySection
        participants={[alice]}
        additionalFees={[]}
        state={state}
        breakdown={calculateBreakdown(state)}
      />,
    )
    const cards = screen.getAllByRole('region')
    expect(cards.map(c => c.getAttribute('aria-label'))).toEqual(['Bill total'])
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  })

  describe('participant receipt on mobile', () => {
    const carol: Participant = { id: 'c', name: 'Carol' }

    function renderCards(state: BillState) {
      setInnerWidth(500)
      render(
        <SummarySection
          participants={state.participants}
          additionalFees={state.additionalFees}
          state={state}
          breakdown={calculateBreakdown(state)}
        />,
      )
    }

    function itemLines(name: string): string[] {
      const list = within(screen.getByRole('region', { name })).queryByRole('list')
      if (!list) return []
      return within(list).getAllByRole('listitem').map(li => li.textContent ?? '')
    }

    it('lists each item a participant is part of, in bill order, with their share', () => {
      renderCards(billState({
        participants: [alice, bob],
        items: [
          { id: 'i1', name: 'Pasta', price: '18', assignedTo: ['a'] },
          { id: 'i2', name: 'Steak', price: '30', assignedTo: ['b'] },
          { id: 'i3', name: 'Wine', price: '40', assignedTo: null },
        ],
      }))
      expect(itemLines('Alice')).toEqual(['Pasta18.00', 'Wine40.00 split with Bob20.00'])
      expect(itemLines('Bob')).toEqual(['Steak30.00', 'Wine40.00 split with Alice20.00'])
    })

    describe('names who else shares an item', () => {
      const dan: Participant = { id: 'd', name: 'Dan' }
      const eve: Participant = { id: 'e', name: 'Eve' }

      it.each([
        { assignedTo: null, caption: '50.00 split with everyone' },
        { assignedTo: ['a', 'b'], caption: '50.00 split with Bob' },
        { assignedTo: ['c', 'a', 'b'], caption: '50.00 split with Bob and Carol' }, // participant order
        { assignedTo: ['a', 'b', 'c'], caption: '50.00 split with Bob and Carol' }, // tie: names win
        { assignedTo: ['a', 'b', 'c', 'd'], caption: '50.00 split with everyone but Eve' },
        { assignedTo: ['a', 'b', 'c', 'e', 'gone'], caption: '50.00 split with everyone but Dan' },
      ])('$assignedTo reads "$caption" on Alice\'s card', ({ assignedTo, caption }) => {
        renderCards(billState({
          participants: [alice, bob, carol, dan, eve],
          items: [{ id: 'i1', name: 'Wine', price: '50', assignedTo }],
        }))
        expect(itemLines('Alice')[0]).toContain(caption)
      })

      it('lists three or more names with a serial comma', () => {
        const fay: Participant = { id: 'f', name: 'Fay' }
        const gus: Participant = { id: 'g', name: 'Gus' }
        renderCards(billState({
          participants: [alice, bob, carol, dan, eve, fay, gus],
          items: [{ id: 'i1', name: 'Wine', price: '40', assignedTo: ['a', 'b', 'c', 'd'] }],
        }))
        expect(itemLines('Alice')[0]).toContain('40.00 split with Bob, Carol, and Dan')
      })

      describe('punctuates the names in the caption', () => {
        const table: Participant[] = ['Alice', 'Bob', 'Carol', 'Dan', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo']
          .map(name => ({ id: name.toLowerCase(), name }))
        const ids = (names: string[]) => names.map(n => n.toLowerCase())
        const allBut = (left: string[]) => table.filter(p => !left.includes(p.name)).map(p => p.id)

        it.each([
          { assignedTo: allBut(['Bob']), names: 'everyone but Bob' },
          { assignedTo: allBut(['Bob', 'Carol']), names: 'everyone but Bob and Carol' },
          { assignedTo: allBut(['Bob', 'Carol', 'Dan']), names: 'everyone but Bob, Carol, and Dan' },
          { assignedTo: allBut(['Bob', 'Carol', 'Dan', 'Eve']), names: 'everyone but Bob, Carol, Dan, and Eve' },
          { assignedTo: ids(['Alice', 'Bob', 'Carol']), names: 'Bob and Carol' },
          { assignedTo: ids(['Alice', 'Bob', 'Carol', 'Dan']), names: 'Bob, Carol, and Dan' },
          { assignedTo: ids(['Alice', 'Bob', 'Carol', 'Dan', 'Eve']), names: 'Bob, Carol, Dan, and Eve' },
        ])('reads "split with $names" on Alice\'s card', ({ assignedTo, names }) => {
          renderCards(billState({
            participants: table,
            items: [{ id: 'i1', name: 'Wine', price: '120', assignedTo }],
          }))
          // Alice's share follows the names directly, so the digit pins where the names end.
          expect(itemLines('Alice')[0]).toMatch(new RegExp(`split with ${names}\\d`))
        })
      })

      it('says everyone when the item is shared by the whole table', () => {
        renderCards(billState({
          participants: [alice, bob, carol],
          items: [{ id: 'i1', name: 'Wine', price: '30', assignedTo: null }],
        }))
        for (const name of ['Alice', 'Bob', 'Carol']) {
          expect(itemLines(name)[0]).toBe('Wine30.00 split with everyone10.00')
        }
      })

      it('leaves an item that is theirs alone without a caption', () => {
        renderCards(billState({
          participants: [alice, bob],
          items: [{ id: 'i1', name: 'Pasta', price: '18', assignedTo: ['a'] }],
        }))
        expect(itemLines('Alice')).toEqual(['Pasta18.00'])
      })
    })

    it('puts the item lines above the subtotal', () => {
      renderCards(billState({
        items: [{ id: 'i1', name: 'Pasta', price: '18', assignedTo: ['a'] }, { id: 'i2', name: 'Soup', price: '6', assignedTo: ['b'] }],
      }))
      const card = within(screen.getByRole('region', { name: 'Alice' }))
      const list = card.getByRole('list')
      const subtotal = card.getByText('Subtotal')
      expect(list.compareDocumentPosition(subtotal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('makes the item lines add up to the subtotal when a split leaves pennies', () => {
      const state = billState({
        participants: [alice, bob, carol],
        items: [
          { id: 'i1', name: 'Nachos', price: '10', assignedTo: null },
          { id: 'i2', name: 'Fries', price: '5', assignedTo: null },
        ],
      })
      renderCards(state)
      const breakdown = calculateBreakdown(state)
      for (const person of state.participants) {
        const sum = itemLines(person.name)
          .map(text => Number(text.match(/(\d+\.\d{2})$/)?.[1]))
          .reduce((a, b) => a + b, 0)
        const subtotal = breakdown.perPerson.find(p => p.participantId === person.id)?.subtotal ?? 0
        expect(sum.toFixed(2)).toBe(subtotal.toFixed(2))
      }
    })

    it('labels an item with no name', () => {
      renderCards(billState({
        items: [{ id: 'i1', name: '  ', price: '8', assignedTo: ['a'] }, { id: 'i2', name: 'Soup', price: '6', assignedTo: ['b'] }],
      }))
      expect(itemLines('Alice')).toEqual(['Unnamed item8.00'])
    })

    it('shows no item list for a participant with no items', () => {
      renderCards(billState({
        items: [{ id: 'i1', name: 'Pasta', price: '18', assignedTo: ['a'] }],
      }))
      expect(itemLines('Bob')).toEqual([])
    })

    it('does not list items on the bill total card', () => {
      renderCards(billState())
      expect(within(screen.getByRole('region', { name: 'Bill total' })).queryByRole('list')).not.toBeInTheDocument()
    })

    it('labels a discount as one on a card whose share of it is zero', () => {
      const fees: AdditionalFee[] = [{ id: 'f1', name: 'Coupon', amount: '-10%', base: 'pre-tax' }]
      renderCards(billState({
        items: [{ id: 'i1', name: 'Pasta', price: '18', assignedTo: ['a'] }],
        additionalFees: fees,
      }))
      for (const name of ['Bill total', 'Alice', 'Bob']) {
        const card = within(screen.getByRole('region', { name }))
        expect(card.getByText('− Coupon (10%)')).toBeInTheDocument()
      }
    })

    it('keeps rates entered as percents in the labels', () => {
      renderCards(billState({ tax: '8.5%', tip: '20%' }))
      const card = within(screen.getByRole('region', { name: 'Alice' }))
      expect(card.getByText('+ Tax (8.5%)')).toBeInTheDocument()
      expect(card.getByText('+ Tip (20%)')).toBeInTheDocument()
    })

    it('leaves out amounts entered in dollars from the labels', () => {
      const fees: AdditionalFee[] = [{ id: 'f1', name: 'Service', amount: '3.00', base: 'pre-tax' }]
      renderCards(billState({ tax: '0.85', tip: '2.00', additionalFees: fees }))
      for (const name of ['Bill total', 'Alice', 'Bob']) {
        const card = within(screen.getByRole('region', { name }))
        expect(card.getByText('+ Tax')).toBeInTheDocument()
        expect(card.getByText('+ Tip')).toBeInTheDocument()
        expect(card.getByText('+ Service')).toBeInTheDocument()
      }
    })
  })
})

describe('SummarySection receipt links', () => {
  const carol: Participant = { id: 'c', name: 'Carol' }
  const three = billState({ participants: [alice, bob, carol] })

  function renderFocus(
    focus: { participantId: string | null; seq: number } | null,
    onFocusDone = vi.fn(),
    bill: BillState = three,
  ) {
    const utils = render(
      <SummarySection
        participants={bill.participants}
        additionalFees={[]}
        state={bill}
        breakdown={calculateBreakdown(bill)}
        focus={focus}
        onFocusDone={onFocusDone}
      />,
    )
    return { ...utils, onFocusDone }
  }

  let scrollIntoView: ReturnType<typeof vi.fn>
  beforeEach(() => {
    scrollIntoView = vi.fn()
    // jsdom doesn't lay pages out, so it has no scrollIntoView.
    Element.prototype.scrollIntoView = scrollIntoView as unknown as Element['scrollIntoView']
  })
  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('puts a share icon on each person card', async () => {
    setInnerWidth(375)
    renderFocus(null)
    for (const name of ['Alice', 'Bob', 'Carol']) {
      const card = screen.getByRole('region', { name })
      const button = within(card).getByRole('button', { name: new RegExp(`link to ${name}'s receipt`) })
      // Enabled once the link encoder has loaded.
      await waitFor(() => expect(button).toBeEnabled())
    }
  })

  it('puts a share icon on the bill total card that shares the bare bill link with a title', async () => {
    setInnerWidth(375)
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })
    try {
      renderFocus(null, vi.fn(), billState({ name: 'Friday dinner', participants: [alice, bob, carol] }))
      const button = within(screen.getByRole('region', { name: 'Bill total for Friday dinner' }))
        .getByRole('button', { name: 'Share link to the bill total' })
      await waitFor(() => expect(button).toBeEnabled())
      await userEvent.click(button)

      const data = share.mock.calls[0][0] as ShareData
      // The same title as the "Share link" button, and no text around the URL.
      expect(data.title).toBe('Bill split for Friday dinner')
      expect(Object.keys(data).sort()).toEqual(['title', 'url'])
      const link = await readIncomingLink(new URL(data.url!).hash)
      if (link?.kind !== 'bill') throw new Error('expected a bill link')
      expect(link.personId).toBeNull()
      expect(link.bill.name).toBe('Friday dinner')
    } finally {
      delete (navigator as unknown as Record<string, unknown>).share
    }
  })

  it('has a share icon on the bill total card even when it is the only card', () => {
    setInnerWidth(375)
    const solo = billState({ participants: [alice] })
    renderFocus(null, vi.fn(), solo)
    expect(within(screen.getByRole('region', { name: 'Bill total' })).getByRole('button')).toBeInTheDocument()
  })

  describe('bill total card title', () => {
    function titles() {
      return screen.getAllByRole('region').map(c => c.getAttribute('aria-label'))
    }

    it('says "Bill total" when the bill has no name', () => {
      setInnerWidth(375)
      renderFocus(null)
      expect(titles()[0]).toBe('Bill total')
    })

    it('treats a name of only spaces as no name', () => {
      setInnerWidth(375)
      renderFocus(null, vi.fn(), billState({ name: '   ', participants: [alice, bob, carol] }))
      expect(titles()[0]).toBe('Bill total')
    })

    it('adds the bill name, trimmed', () => {
      setInnerWidth(375)
      renderFocus(null, vi.fn(), billState({ name: '  Friday dinner ', participants: [alice, bob, carol] }))
      expect(titles()[0]).toBe('Bill total for Friday dinner')
      expect(screen.getByText('Bill total for Friday dinner')).toBeVisible()
    })

    it('keeps a long name on one line and offers the full title on hover', () => {
      setInnerWidth(375)
      const name = 'A very long name for a dinner that went on and on and on and on'
      renderFocus(null, vi.fn(), billState({ name, participants: [alice, bob, carol] }))
      const title = screen.getByText(`Bill total for ${name}`)
      expect(title).toHaveClass('truncate')
      expect(title).toHaveAttribute('title', `Bill total for ${name}`)
    })

    it('does not rename the person cards', () => {
      setInnerWidth(375)
      renderFocus(null, vi.fn(), billState({ name: 'Friday dinner', participants: [alice, bob, carol] }))
      expect(titles().slice(1)).toEqual(['Alice', 'Bob', 'Carol'])
    })
  })

  it('has no share icons in the desktop table', () => {
    renderFocus(null)
    expect(screen.queryByRole('button', { name: /receipt/ })).toBeNull()
  })

  it('scrolls to the focused person card and rings it until the highlight ends', async () => {
    vi.useFakeTimers()
    setInnerWidth(375)
    const { onFocusDone } = renderFocus({ participantId: 'b', seq: 1 })
    const card = screen.getByRole('region', { name: 'Bob' })
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(card)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(card).toHaveAttribute('data-focused')
    expect(screen.getByRole('region', { name: 'Alice' })).not.toHaveAttribute('data-focused')

    act(() => vi.advanceTimersByTime(FOCUS_HIGHLIGHT_MS - 1))
    expect(onFocusDone).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onFocusDone).toHaveBeenCalledTimes(1)
  })

  it('jumps without animation, and highlights for longer, with reduced motion', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }))
    setInnerWidth(375)
    const { onFocusDone } = renderFocus({ participantId: 'c', seq: 1 })
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
    act(() => vi.advanceTimersByTime(FOCUS_HIGHLIGHT_MS))
    expect(onFocusDone).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(FOCUS_HIGHLIGHT_REDUCED_MOTION_MS - FOCUS_HIGHLIGHT_MS))
    expect(onFocusDone).toHaveBeenCalledTimes(1)
  })

  it('scrolls again when the same person is focused again', () => {
    setInnerWidth(375)
    const { rerender, onFocusDone } = renderFocus({ participantId: 'a', seq: 1 })
    rerender(
      <SummarySection
        participants={three.participants}
        additionalFees={[]}
        state={three}
        breakdown={calculateBreakdown(three)}
        focus={{ participantId: 'a', seq: 2 }}
        onFocusDone={onFocusDone}
      />,
    )
    expect(scrollIntoView).toHaveBeenCalledTimes(2)
  })

  it('scrolls to the table and tints the person column on desktop', () => {
    renderFocus({ participantId: 'b', seq: 1 })
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('table').parentElement)
    const row = screen.getByText('Subtotal').closest('tr')!
    const cells = within(row).getAllByRole('cell')
    // Label, Total, then Alice, Bob, Carol.
    expect(cells.map(c => c.hasAttribute('data-focused'))).toEqual([false, false, false, true, false])
  })

  describe('when the focus is the whole bill', () => {
    it('jumps to the bill total card without animation, and does not highlight it', () => {
      vi.useFakeTimers()
      setInnerWidth(375)
      const { onFocusDone } = renderFocus({ participantId: null, seq: 1 })
      const card = screen.getByRole('region', { name: 'Bill total' })
      expect(scrollIntoView).toHaveBeenCalledTimes(1)
      expect(scrollIntoView.mock.contexts[0]).toBe(card)
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
      expect(card).not.toHaveAttribute('data-focused')
      // Nothing to wait for, so the request is over straight away.
      expect(onFocusDone).toHaveBeenCalledTimes(1)
    })

    it('jumps even when the visitor prefers reduced motion', () => {
      vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }))
      setInnerWidth(375)
      renderFocus({ participantId: null, seq: 1 })
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
    })

    it('scrolls to the bill total card on a one-person bill', () => {
      setInnerWidth(375)
      renderFocus({ participantId: null, seq: 1 }, vi.fn(), billState({ participants: [alice] }))
      expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('region', { name: 'Bill total' }))
    })

    it('does not scroll on wide screens, where the table is already in view', () => {
      const { onFocusDone } = renderFocus({ participantId: null, seq: 1 })
      expect(scrollIntoView).not.toHaveBeenCalled()
      expect(onFocusDone).toHaveBeenCalledTimes(1)
    })

    it('scrolls again for a second request', () => {
      setInnerWidth(375)
      const { rerender, onFocusDone } = renderFocus({ participantId: null, seq: 1 })
      rerender(
        <SummarySection
          participants={three.participants}
          additionalFees={[]}
          state={three}
          breakdown={calculateBreakdown(three)}
          focus={{ participantId: null, seq: 2 }}
          onFocusDone={onFocusDone}
        />,
      )
      expect(scrollIntoView).toHaveBeenCalledTimes(2)
    })

    it('does not scroll when there is no request', () => {
      setInnerWidth(375)
      renderFocus(null)
      expect(scrollIntoView).not.toHaveBeenCalled()
    })
  })

  it('finishes straight away when the person is not on the bill', () => {
    setInnerWidth(375)
    const { onFocusDone } = renderFocus({ participantId: 'nobody', seq: 1 })
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(onFocusDone).toHaveBeenCalledTimes(1)
  })
})
