import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SummarySection } from './SummarySection'
import { calculateBreakdown } from '../utils/calculate'
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
        orderedParticipants={[]}
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
        orderedParticipants={[alice, bob]}
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
        orderedParticipants={[alice, bob]}
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
        orderedParticipants={[alice, bob]}
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
        orderedParticipants={[alice, bob]}
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
        orderedParticipants={[alice, bob]}
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
        orderedParticipants={[alice, bob]}
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
        orderedParticipants={[alice, bob]}
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
})
