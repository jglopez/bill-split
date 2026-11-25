import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShareBillButtons } from './ShareBillButtons'
import { sampleBill } from '../share/fixtures/sampleBill'
import { buildShareData } from '../share/shareData'
import { toSummaryTemplateData } from '../share/summary/templateData'
import { renderSummary, renderSummaryHtml } from '../share/summary/renderSummary'
import { calculateBreakdown, calculateSettlement } from '../utils/calculate'
import { billLinkUrl, decodeBillHash } from '../share/link/billLink'

// jsdom has no ClipboardItem; a minimal stand-in records what it was given.
class FakeClipboardItem {
  constructor(readonly items: Record<string, Blob>) {}
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete (navigator as unknown as Record<string, unknown>).clipboard
  delete (navigator as unknown as Record<string, unknown>).share
})

function install(name: 'share' | 'clipboard', value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true, writable: true })
}

function renderButtons() {
  const breakdown = calculateBreakdown(sampleBill)
  const transactions = calculateSettlement(sampleBill, breakdown)
  render(<ShareBillButtons state={sampleBill} breakdown={breakdown} transactions={transactions} />)
}

async function enabledButton(name: string) {
  const button = screen.getByRole('button', { name })
  await vi.waitFor(() => expect(button).toBeEnabled())
  return button
}

const summaryData = () => toSummaryTemplateData(buildShareData(sampleBill), billLinkUrl(sampleBill))

describe('ShareBillButtons', () => {
  it('copies the summary as plain and rich text, even where there is a share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const write = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    install('share', share)
    const user = userEvent.setup()
    install('clipboard', { write, writeText: vi.fn() })
    renderButtons()

    await user.click(await enabledButton('Copy summary'))
    expect(share).not.toHaveBeenCalled()
    const [[[item]]] = write.mock.calls as [[[FakeClipboardItem]]]
    expect(await item.items['text/plain'].text()).toBe(renderSummary(summaryData()))
    expect(await item.items['text/html'].text()).toBe(renderSummaryHtml(summaryData()))
  })

  it('ends the copied summary with a link that opens the same bill', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    install('clipboard', { writeText })
    renderButtons()

    await user.click(await enabledButton('Copy summary'))
    const text = writeText.mock.calls[0][0] as string
    const url = new URL(text.split('\n').at(-1)!)
    expect(url.origin).toBe(window.location.origin)
    const opened = await decodeBillHash(url.hash)
    expect(opened.name).toBe(sampleBill.name)
    expect(opened.participants.map(p => p.name)).toEqual(sampleBill.participants.map(p => p.name))
  })

  it('shares only the bill link through the share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    install('share', share)
    renderButtons()

    await userEvent.click(await enabledButton('Share link'))
    expect(share).toHaveBeenCalledWith({ title: sampleBill.name.trim(), url: billLinkUrl(sampleBill) })
  })

  it('copies only the bill link where there is no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    install('clipboard', { writeText })
    renderButtons()

    await user.click(await enabledButton('Copy link'))
    expect(writeText).toHaveBeenCalledWith(billLinkUrl(sampleBill))
  })
})
