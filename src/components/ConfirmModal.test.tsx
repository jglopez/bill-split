import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmModal } from './ConfirmModal'

describe('ConfirmModal', () => {
  it('renders the title and message', () => {
    render(<ConfirmModal title="Reset bill?" message="This clears everything." onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Reset bill?')).toBeInTheDocument()
    expect(screen.getByText('This clears everything.')).toBeInTheDocument()
  })

  it('defaults the confirm button label to "Confirm"', () => {
    render(<ConfirmModal title="t" message="m" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
  })

  it('uses a custom confirmLabel when provided', () => {
    render(<ConfirmModal title="t" message="m" confirmLabel="Delete" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<ConfirmModal title="t" message="m" onConfirm={onConfirm} onCancel={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<ConfirmModal title="t" message="m" onConfirm={vi.fn()} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when the backdrop is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    const { container } = render(<ConfirmModal title="t" message="m" onConfirm={vi.fn()} onCancel={onCancel} />)
    const backdrop = container.querySelector('[aria-hidden="true"]')
    expect(backdrop).not.toBeNull()
    await user.click(backdrop!)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Escape is pressed', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<ConfirmModal title="t" message="m" onConfirm={vi.fn()} onCancel={onCancel} />)
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
