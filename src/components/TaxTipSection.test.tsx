import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaxTipSection } from './TaxTipSection'
import type { AdditionalFee } from '../types'

function baseProps() {
  return {
    tax: '',
    tip: '',
    tipBase: 'pre-tax' as const,
    tipDiscountBase: 'pre-discount' as const,
    tipFeeBase: 'pre-fee' as const,
    additionalFees: [] as AdditionalFee[],
    taxableSubtotal: 100,
    totalSubtotal: 100,
    adjustedTotalSubtotal: 100,
    tipAmountBase: 100,
    totalTax: 0,
    onSetTax: vi.fn(),
    onSetTip: vi.fn(),
    onSetTipBase: vi.fn(),
    onSetTipDiscountBase: vi.fn(),
    onSetTipFeeBase: vi.fn(),
    onAddFee: vi.fn(),
    onUpdateFee: vi.fn(),
    onRemoveFee: vi.fn(),
  }
}

describe('TaxTipSection', () => {
  it('calls onSetTax when the tax input changes', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<TaxTipSection {...props} />)
    await user.type(screen.getByLabelText('Tax amount'), '5')
    expect(props.onSetTax).toHaveBeenCalledWith('5')
  })

  it('flags an invalid tax amount', () => {
    render(<TaxTipSection {...baseProps()} tax="abc" />)
    expect(screen.getByLabelText('Tax amount')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByText('Invalid amount')[0]).toBeInTheDocument()
  })

  it('calls onSetTip when the tip input changes', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<TaxTipSection {...props} />)
    await user.type(screen.getByLabelText('Tip amount'), '2')
    expect(props.onSetTip).toHaveBeenCalledWith('2')
  })

  it('toggles the tip amount to percent mode via the % button', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<TaxTipSection {...props} tip="20" />)
    const [, tipPercentButton] = screen.getAllByLabelText('Switch to percentage')
    await user.click(tipPercentButton)
    expect(props.onSetTip).toHaveBeenCalledWith('20%')
  })

  it('shows the dollar equivalent for a percent tip', () => {
    render(<TaxTipSection {...baseProps()} tip="10%" tipAmountBase={100} />)
    expect(screen.getByText('$10.00')).toBeInTheDocument()
  })

  it('disables the "incl. tax" toggle for a tip in dollar mode and shows a tooltip instead', () => {
    render(<TaxTipSection {...baseProps()} tip="20" />)
    expect(screen.queryByText('incl. tax')).not.toBeInTheDocument()
    expect(screen.getByTitle('Switch to % to calculate this on the pre- or post-tax subtotal.')).toBeInTheDocument()
  })

  it('enables the "incl. tax" toggle for a percent tip and calls onSetTipBase', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<TaxTipSection {...props} tip="20%" />)
    await user.click(screen.getByRole('checkbox', { name: 'incl. tax' }))
    expect(props.onSetTipBase).toHaveBeenCalledWith('post-tax')
  })

  it('does not show the "after discount"/"after fee" toggles when there are no pre-tax fees', () => {
    render(<TaxTipSection {...baseProps()} />)
    expect(screen.queryByText('after discount')).not.toBeInTheDocument()
    expect(screen.queryByText('after fee')).not.toBeInTheDocument()
  })

  it('shows the "after discount" toggle when a pre-tax discount exists and calls onSetTipDiscountBase', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const fees: AdditionalFee[] = [{ id: 'f1', name: 'Coupon', amount: '-10', base: 'pre-tax' }]
    render(<TaxTipSection {...props} additionalFees={fees} />)
    const toggle = screen.getByRole('checkbox', { name: 'after discount' })
    await user.click(toggle)
    expect(props.onSetTipDiscountBase).toHaveBeenCalledWith('post-discount')
  })

  it('shows the "after fee" toggle when a pre-tax surcharge exists and calls onSetTipFeeBase', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const fees: AdditionalFee[] = [{ id: 'f1', name: 'Service', amount: '10', base: 'pre-tax' }]
    render(<TaxTipSection {...props} additionalFees={fees} />)
    const toggle = screen.getByRole('checkbox', { name: 'after fee' })
    await user.click(toggle)
    expect(props.onSetTipFeeBase).toHaveBeenCalledWith('post-fee')
  })

  it('flags an invalid tip amount', () => {
    render(<TaxTipSection {...baseProps()} tip="abc" />)
    expect(screen.getByLabelText('Tip amount')).toHaveAttribute('aria-invalid', 'true')
  })

  it('renders a fee row per additional fee and labels it as a fee or discount', () => {
    const fees: AdditionalFee[] = [
      { id: 'f1', name: 'Service', amount: '10', base: 'pre-tax' },
      { id: 'f2', name: 'Coupon', amount: '-5', base: 'pre-tax' },
    ]
    render(<TaxTipSection {...baseProps()} additionalFees={fees} />)
    expect(screen.getByText('+ Fee')).toBeInTheDocument()
    expect(screen.getByText('− Discount')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Fee name')).toHaveLength(2)
  })

  it('calls onUpdateFee when a fee name is edited', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const fees: AdditionalFee[] = [{ id: 'f1', name: '', amount: '10', base: 'pre-tax' }]
    render(<TaxTipSection {...props} additionalFees={fees} />)
    await user.type(screen.getByLabelText('Fee name'), 'X')
    expect(props.onUpdateFee).toHaveBeenCalledWith({ id: 'f1', name: 'X', amount: '10', base: 'pre-tax' })
  })

  it('calls onUpdateFee when a fee amount is edited', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const fees: AdditionalFee[] = [{ id: 'f1', name: 'Service', amount: '', base: 'pre-tax' }]
    render(<TaxTipSection {...props} additionalFees={fees} />)
    await user.type(screen.getByLabelText('Service amount'), '5')
    expect(props.onUpdateFee).toHaveBeenCalledWith({ id: 'f1', name: 'Service', amount: '5', base: 'pre-tax' })
  })

  it('toggles a fee to a discount via the sign button', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const fees: AdditionalFee[] = [{ id: 'f1', name: 'Service', amount: '10', base: 'pre-tax' }]
    render(<TaxTipSection {...props} additionalFees={fees} />)
    await user.click(screen.getByLabelText('Switch to discount'))
    expect(props.onUpdateFee).toHaveBeenCalledWith({ id: 'f1', name: 'Service', amount: '-10', base: 'pre-tax' })
  })

  it('toggles a fee\'s tax base via its "incl. tax" checkbox', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const fees: AdditionalFee[] = [{ id: 'f1', name: 'Service', amount: '10', base: 'pre-tax' }]
    render(<TaxTipSection {...props} additionalFees={fees} />)
    await user.click(screen.getByRole('checkbox', { name: 'incl. tax' }))
    expect(props.onUpdateFee).toHaveBeenCalledWith({ id: 'f1', name: 'Service', amount: '10', base: 'post-tax' })
  })

  it('flags an invalid fee amount', () => {
    const fees: AdditionalFee[] = [{ id: 'f1', name: 'Service', amount: 'abc', base: 'pre-tax' }]
    render(<TaxTipSection {...baseProps()} additionalFees={fees} />)
    expect(screen.getByLabelText('Service amount')).toHaveAttribute('aria-invalid', 'true')
  })

  it('calls onRemoveFee when the remove button is clicked', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const fees: AdditionalFee[] = [{ id: 'f1', name: 'Service', amount: '10', base: 'pre-tax' }]
    render(<TaxTipSection {...props} additionalFees={fees} />)
    await user.click(screen.getByLabelText('Remove Service'))
    expect(props.onRemoveFee).toHaveBeenCalledWith('f1')
  })

  it('calls onAddFee when the add-fee button is clicked', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<TaxTipSection {...props} />)
    await user.click(screen.getByText('+ Add fee / discount'))
    expect(props.onAddFee).toHaveBeenCalled()
  })
})
