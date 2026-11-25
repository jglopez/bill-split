import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShareButton, STATUS_TIMEOUT_MS } from './ShareButton'

const installed: string[] = []

function install(name: 'share' | 'clipboard', value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true, writable: true })
  installed.push(name)
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  for (const name of installed.splice(0)) {
    delete (navigator as unknown as Record<string, unknown>)[name]
  }
})

describe('ShareButton', () => {
  it('offers to share when the browser has a share sheet, and shares on click', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    install('share', share)
    render(<ShareButton label="summary" getContent={() => ({ text: 'hi', title: 'Dinner' })} />)

    await userEvent.click(screen.getByRole('button', { name: 'Share summary' }))
    expect(share).toHaveBeenCalledWith({ text: 'hi', title: 'Dinner' })
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('offers to copy without a share sheet, and confirms the copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    render(<ShareButton label="summary" getContent={() => ({ text: 'hi' })} />)
    // userEvent installs its own clipboard stub, so replace it after setup.
    const user = userEvent.setup()
    install('clipboard', { writeText })

    await user.click(screen.getByRole('button', { name: 'Copy summary' }))
    expect(writeText).toHaveBeenCalledWith('hi')
    expect(await screen.findByRole('status')).toHaveTextContent('Copied!')
    // The button itself says so too, then goes back to its label.
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument()
  })

  it('says so when neither sharing nor copying works', async () => {
    const user = userEvent.setup()
    install('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    render(<ShareButton label="summary" getContent={() => ({ text: 'hi' })} />)

    await user.click(screen.getByRole('button', { name: 'Copy summary' }))
    expect(await screen.findByRole('status')).toHaveTextContent("Couldn't copy")
  })

  it('clears the confirmation after a while', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    install('clipboard', { writeText: vi.fn().mockResolvedValue(undefined) })
    render(<ShareButton label="summary" getContent={() => ({ text: 'hi' })} />)

    await user.click(screen.getByRole('button', { name: 'Copy summary' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Copied!')
    await act(() => vi.runAllTimersAsync())
    expect(screen.getByRole('status')).toHaveTextContent('')
    expect(screen.getByRole('button', { name: 'Copy summary' })).toBeInTheDocument()
  })

  it('does nothing while disabled', async () => {
    const getContent = vi.fn(() => ({ text: 'hi' }))
    render(<ShareButton label="summary" getContent={getContent} disabled />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy summary' }))
    expect(getContent).not.toHaveBeenCalled()
  })

  it('shows the failure status when the content cannot be prepared', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const writeText = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    install('clipboard', { writeText })
    render(<ShareButton label="summary" getContent={() => { throw new Error('NaN total') }} />)

    await user.click(screen.getByRole('button', { name: 'Copy summary' }))
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't copy")
    expect(writeText).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('ignores clicks while a share is still open', async () => {
    let finish: () => void = () => {}
    const share = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    install('share', share)
    const user = userEvent.setup()
    render(<ShareButton label="summary" getContent={() => ({ text: 'hi' })} />)

    const button = screen.getByRole('button', { name: 'Share summary' })
    await user.click(button)
    expect(button).toBeDisabled()
    await user.click(button)
    expect(share).toHaveBeenCalledTimes(1)

    await act(async () => finish())
    expect(button).toBeEnabled()
  })

  it('keeps a repeated confirmation up for the full time after the latest copy', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    install('clipboard', { writeText: vi.fn().mockResolvedValue(undefined) })
    render(<ShareButton label="summary" getContent={() => ({ text: 'hi' })} />)
    const button = screen.getByRole('button')

    await user.click(button)
    expect(await screen.findByRole('status')).toHaveTextContent('Copied!')
    // Most of the way through the first confirmation, copy again.
    await act(() => vi.advanceTimersByTimeAsync(STATUS_TIMEOUT_MS * 0.75))
    await user.click(button)
    await act(() => vi.advanceTimersByTimeAsync(STATUS_TIMEOUT_MS * 0.75))
    // The first timer would have cleared it by now; the restarted one hasn't.
    expect(screen.getByRole('status')).toHaveTextContent('Copied!')
    await act(() => vi.runAllTimersAsync())
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('always copies with action="copy", even where there is a share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn().mockResolvedValue(undefined)
    install('share', share)
    const user = userEvent.setup()
    install('clipboard', { writeText })
    render(<ShareButton label="summary" action="copy" getContent={() => ({ text: 'hi' })} />)

    await user.click(screen.getByRole('button', { name: 'Copy summary' }))
    expect(share).not.toHaveBeenCalled()
    expect(writeText).toHaveBeenCalledWith('hi')
    expect(await screen.findByRole('status')).toHaveTextContent('Copied!')
  })

  it('puts the rich text on the clipboard with action="copy"', async () => {
    // jsdom has no ClipboardItem; a minimal stand-in records what it was given.
    vi.stubGlobal('ClipboardItem', class {
      constructor(readonly items: Record<string, Blob>) {}
    })
    const write = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    install('clipboard', { write, writeText: vi.fn() })
    render(
      <ShareButton label="summary" action="copy" getContent={() => ({ text: 'hi', html: '<b>hi</b>' })} />,
    )

    await user.click(screen.getByRole('button', { name: 'Copy summary' }))
    expect(write).toHaveBeenCalledTimes(1)
    const [[[item]]] = write.mock.calls as [[[{ items: Record<string, Blob> }]]]
    expect(await item.items['text/html'].text()).toBe('<b>hi</b>')
    expect(await item.items['text/plain'].text()).toBe('hi')
  })

  it('says the share failed, not the copy, when it used the share sheet', async () => {
    install('share', vi.fn().mockRejectedValue(new DOMException('nope', 'NotAllowedError')))
    const user = userEvent.setup()
    install('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    render(<ShareButton label="link" getContent={() => ({ text: '', url: 'https://example.test/#b=1' })} />)

    await user.click(screen.getByRole('button', { name: 'Share link' }))
    expect(await screen.findByRole('status')).toHaveTextContent("Couldn't share")
  })
})
