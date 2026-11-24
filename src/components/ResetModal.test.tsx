import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResetModal } from './ResetModal'

function renderModal(overrides: Partial<Parameters<typeof ResetModal>[0]> = {}) {
  const props = {
    hasParticipants: true,
    hasItems: true,
    onClearParticipants: vi.fn(),
    onClearItems: vi.fn(),
    onResetAll: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }
  const result = render(<ResetModal {...props} />)
  return { ...result, props }
}

describe('ResetModal', () => {
  it('is a dialog named for what it does', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Reset bill' })).toBeInTheDocument()
  })

  it('offers each reset option, each described by what it clears', () => {
    renderModal()
    expect(screen.getByRole('button', { name: 'Clear participants' })).toHaveAccessibleDescription(/Removes everyone. Your items/)
    expect(screen.getByRole('button', { name: 'Clear items' })).toHaveAccessibleDescription(/bill name/)
    expect(screen.getByRole('button', { name: 'Reset all' })).toHaveAccessibleDescription(/whole bill/)
  })

  it.each([
    ['Clear participants', 'onClearParticipants'],
    ['Clear items', 'onClearItems'],
    ['Reset all', 'onResetAll'],
  ] as const)('%s calls only its own handler', async (label, handler) => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.click(screen.getByRole('button', { name: label }))
    for (const name of ['onClearParticipants', 'onClearItems', 'onResetAll', 'onCancel'] as const) {
      expect(props[name]).toHaveBeenCalledTimes(name === handler ? 1 : 0)
    }
  })

  it('disables an option that has nothing to clear', () => {
    renderModal({ hasParticipants: false, hasItems: false })
    expect(screen.getByRole('button', { name: 'Clear participants' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear items' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reset all' })).toBeEnabled()
  })

  it('starts with focus on Cancel so a stray Enter clears nothing', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(props.onCancel).toHaveBeenCalledTimes(1)
    expect(props.onResetAll).not.toHaveBeenCalled()
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const { container, props } = renderModal()
    const backdrop = container.querySelector('[aria-hidden="true"]')
    expect(backdrop).not.toBeNull()
    await user.click(backdrop!)
    expect(props.onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Escape is pressed', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.keyboard('{Escape}')
    expect(props.onCancel).toHaveBeenCalledTimes(1)
  })
})
