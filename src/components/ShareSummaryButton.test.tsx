import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShareSummaryButton } from './ShareSummaryButton'
import { sampleBill } from '../share/fixtures/sampleBill'
import { buildShareData } from '../share/shareData'
import { toSummaryTemplateData } from '../share/summary/templateData'
import { renderSummary } from '../share/summary/renderSummary'
import { calculateBreakdown, calculateSettlement } from '../utils/calculate'

afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>).clipboard
})

describe('ShareSummaryButton', () => {
  it('copies the rendered summary once the template engine has loaded', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const breakdown = calculateBreakdown(sampleBill)
    const transactions = calculateSettlement(sampleBill, breakdown)

    render(<ShareSummaryButton state={sampleBill} breakdown={breakdown} transactions={transactions} />)
    const button = screen.getByRole('button', { name: 'Copy summary' })
    await vi.waitFor(() => expect(button).toBeEnabled())

    await userEvent.click(button)
    expect(writeText).toHaveBeenCalledWith(renderSummary(toSummaryTemplateData(buildShareData(sampleBill))))
  })
})
