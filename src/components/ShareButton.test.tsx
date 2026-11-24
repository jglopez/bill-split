import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShareButton } from './ShareButton'

const installed: string[] = []

function install(name: 'share' | 'clipboard', value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true, writable: true })
  installed.push(name)
}

afterEach(() => {
  vi.useRealTimers()
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
    expect(await screen.findByRole('status')).toHaveTextContent('Copied to clipboard')
  })

  it('says so when neither sharing nor copying works', async () => {
    const user = userEvent.setup()
    install('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    render(<ShareButton label="summary" getContent={() => ({ text: 'hi' })} />)

    await user.click(screen.getByRole('button', { name: 'Copy summary' }))
    expect(await screen.findByRole('status')).toHaveTextContent("Couldn't share or copy")
  })

  it('clears the confirmation after a while', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    install('clipboard', { writeText: vi.fn().mockResolvedValue(undefined) })
    render(<ShareButton label="summary" getContent={() => ({ text: 'hi' })} />)

    await user.click(screen.getByRole('button', { name: 'Copy summary' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Copied to clipboard')
    await act(() => vi.runAllTimersAsync())
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('does nothing while disabled', async () => {
    const getContent = vi.fn(() => ({ text: 'hi' }))
    render(<ShareButton label="summary" getContent={getContent} disabled />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy summary' }))
    expect(getContent).not.toHaveBeenCalled()
  })
})
