import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShareSummaryButton } from './ShareSummaryButton'
import { sampleBill } from '../share/fixtures/sampleBill'
import { buildShareData } from '../share/shareData'
import { toSummaryTemplateData } from '../share/summary/templateData'
import { renderSummary } from '../share/summary/renderSummary'
import { calculateBreakdown, calculateSettlement } from '../utils/calculate'
import { billLinkUrl, decodeBillHash } from '../share/link/billLink'

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
    const link = billLinkUrl(sampleBill)
    expect(writeText).toHaveBeenCalledWith(renderSummary(toSummaryTemplateData(buildShareData(sampleBill), link)))
  })

  it('ends the summary with a link that opens the same bill', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const breakdown = calculateBreakdown(sampleBill)
    const transactions = calculateSettlement(sampleBill, breakdown)

    render(<ShareSummaryButton state={sampleBill} breakdown={breakdown} transactions={transactions} />)
    const button = screen.getByRole('button', { name: 'Copy summary' })
    await vi.waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)

    const text = writeText.mock.calls[0][0] as string
    const url = new URL(text.split('\n').at(-1)!)
    expect(url.origin).toBe(window.location.origin)
    const opened = await decodeBillHash(url.hash)
    expect(opened.name).toBe(sampleBill.name)
    expect(opened.participants.map(p => p.name)).toEqual(sampleBill.participants.map(p => p.name))
  })
})
