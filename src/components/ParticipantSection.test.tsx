import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ParticipantSection } from './ParticipantSection'
import type { Participant } from '../types'

const alice: Participant = { id: 'a', name: 'Alice' }

describe('ParticipantSection', () => {
  it('adds a trimmed name via the Add button and clears the input', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<ParticipantSection participants={[]} onAdd={onAdd} onRemove={vi.fn()} onRename={vi.fn()} />)

    const input = screen.getByLabelText('New participant name')
    await user.type(input, '  Bob  ')
    await user.click(screen.getByLabelText('Add participant'))

    expect(onAdd).toHaveBeenCalledWith('Bob')
    expect(input).toHaveValue('')
  })

  it('adds via Enter key', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<ParticipantSection participants={[]} onAdd={onAdd} onRemove={vi.fn()} onRename={vi.fn()} />)

    await user.type(screen.getByLabelText('New participant name'), 'Carol{Enter}')
    expect(onAdd).toHaveBeenCalledWith('Carol')
  })

  it('shows an error and does not call onAdd for an empty name', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<ParticipantSection participants={[]} onAdd={onAdd} onRemove={vi.fn()} onRename={vi.fn()} />)

    await user.click(screen.getByLabelText('Add participant'))
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required.')
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('renames a participant by editing the chip and pressing Enter', async () => {
    const onRename = vi.fn()
    const user = userEvent.setup()
    render(<ParticipantSection participants={[alice]} onAdd={vi.fn()} onRemove={vi.fn()} onRename={onRename} />)

    await user.click(screen.getByRole('button', { name: 'Rename Alice' }))
    const editInput = screen.getByLabelText('Rename Alice')
    await user.clear(editInput)
    await user.type(editInput, 'Alicia{Enter}')

    expect(onRename).toHaveBeenCalledWith('a', 'Alicia')
  })

  it('reverts an in-progress rename on Escape without calling onRename', async () => {
    const onRename = vi.fn()
    const user = userEvent.setup()
    render(<ParticipantSection participants={[alice]} onAdd={vi.fn()} onRemove={vi.fn()} onRename={onRename} />)

    await user.click(screen.getByRole('button', { name: 'Rename Alice' }))
    const editInput = screen.getByLabelText('Rename Alice')
    await user.clear(editInput)
    await user.type(editInput, 'Changed{Escape}')

    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Rename Alice' })).toHaveTextContent('Alice')
  })

  it('removes a participant via the remove button', async () => {
    const onRemove = vi.fn()
    const user = userEvent.setup()
    render(<ParticipantSection participants={[alice]} onAdd={vi.fn()} onRemove={onRemove} onRename={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Remove Alice' }))
    expect(onRemove).toHaveBeenCalledWith('a')
  })
})
