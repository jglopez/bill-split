import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { SummarySection } from './SummarySection'
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
    expect(screen.getByText('+ Service (10)')).toHaveClass('text-gray-700')
    expect(screen.getByText('− Coupon (-2)')).toHaveClass('text-green-700')
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
