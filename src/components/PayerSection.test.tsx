import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PayerSection } from './PayerSection'
import { calculateBreakdown } from '../utils/calculate'
import type { BillState, Participant } from '../types'

const alice: Participant = { id: 'a', name: 'Alice' }
const bob: Participant = { id: 'b', name: 'Bob' }

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

describe('PayerSection', () => {
  it('renders nothing when there are no participants', () => {
    const state = billState({ participants: [] })
    const { container } = render(
      <PayerSection
        participants={[]}
        state={state}
        breakdown={calculateBreakdown(state)}
        onSetPayerMode={vi.fn()}
        onSetSinglePayer={vi.fn()}
        onSetAmountPaid={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('single mode: lists a dropdown option per participant and calls onSetSinglePayer on selection', async () => {
    const onSetSinglePayer = vi.fn()
    const user = userEvent.setup()
    const state = billState()
    render(
      <PayerSection
        participants={[alice, bob]}
        state={state}
        breakdown={calculateBreakdown(state)}
        onSetPayerMode={vi.fn()}
        onSetSinglePayer={onSetSinglePayer}
        onSetAmountPaid={vi.fn()}
      />,
    )
    const select = screen.getByLabelText('Who paid the bill')
    expect(screen.getAllByRole('option')).toHaveLength(2)
    await user.selectOptions(select, 'b')
    expect(onSetSinglePayer).toHaveBeenCalledWith('b')
  })

  it('switches to multiple-payer mode via the radio toggle', async () => {
    const onSetPayerMode = vi.fn()
    const user = userEvent.setup()
    const state = billState()
    render(
      <PayerSection
        participants={[alice, bob]}
        state={state}
        breakdown={calculateBreakdown(state)}
        onSetPayerMode={onSetPayerMode}
        onSetSinglePayer={vi.fn()}
        onSetAmountPaid={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('radio', { name: 'Multiple people' }))
    expect(onSetPayerMode).toHaveBeenCalledWith('multiple')
  })

  it('multiple mode: renders one amount input per participant and calls onSetAmountPaid on input', async () => {
    const onSetAmountPaid = vi.fn()
    const user = userEvent.setup()
    const state = billState({ payerMode: 'multiple' })
    render(
      <PayerSection
        participants={[alice, bob]}
        state={state}
        breakdown={calculateBreakdown(state)}
        onSetPayerMode={vi.fn()}
        onSetSinglePayer={vi.fn()}
        onSetAmountPaid={onSetAmountPaid}
      />,
    )
    await user.type(screen.getByLabelText('Amount paid by Alice'), '5')
    expect(onSetAmountPaid).toHaveBeenCalledWith('a', '5')
  })

  it('multiple mode: flags an invalid amount', () => {
    const state = billState({ payerMode: 'multiple', amountPaid: { a: '-5' } })
    render(
      <PayerSection
        participants={[alice, bob]}
        state={state}
        breakdown={calculateBreakdown(state)}
        onSetPayerMode={vi.fn()}
        onSetSinglePayer={vi.fn()}
        onSetAmountPaid={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Amount paid by Alice')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Invalid amount')).toBeInTheDocument()
  })

  it('multiple mode: shows a mismatch banner only when totals paid disagree with the grand total', () => {
    const mismatched = billState({ payerMode: 'multiple', amountPaid: { a: '3', b: '3' } })
    const { rerender } = render(
      <PayerSection
        participants={[alice, bob]}
        state={mismatched}
        breakdown={calculateBreakdown(mismatched)}
        onSetPayerMode={vi.fn()}
        onSetSinglePayer={vi.fn()}
        onSetAmountPaid={vi.fn()}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent("doesn't match the grand total")

    const settled = billState({ payerMode: 'multiple', amountPaid: { a: '5', b: '5' } })
    rerender(
      <PayerSection
        participants={[alice, bob]}
        state={settled}
        breakdown={calculateBreakdown(settled)}
        onSetPayerMode={vi.fn()}
        onSetSinglePayer={vi.fn()}
        onSetAmountPaid={vi.fn()}
      />,
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
