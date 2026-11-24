import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ParticipantSection } from './ParticipantSection'
import { SM_BREAKPOINT_PX } from '../hooks/useIsMobile'
import type { Participant } from '../types'

const alice: Participant = { id: 'a', name: 'Alice' }
const bob: Participant = { id: 'b', name: 'Bob' }

const DEFAULT_WIDTH = window.innerWidth
const NARROW_WIDTH = SM_BREAKPOINT_PX - 1
const WIDE_WIDTH = SM_BREAKPOINT_PX

function setInnerWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
  window.dispatchEvent(new Event('resize'))
}

afterEach(() => {
  setInnerWidth(DEFAULT_WIDTH)
})

// Chips (wide) and the one-per-line list (narrow) use the same accessible
// names, so every behavior test runs against both.
describe.each([
  { layout: 'chips', width: WIDE_WIDTH },
  { layout: 'list', width: NARROW_WIDTH },
])('ParticipantSection ($layout layout)', ({ width }) => {
  beforeEach(() => {
    setInnerWidth(width)
  })

  it('adds a trimmed name via the Add button and clears the input', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<ParticipantSection participants={[]} onAdd={onAdd} onRemove={vi.fn()} onRename={vi.fn()} onReorder={vi.fn()} />)

    const input = screen.getByLabelText('New participant name')
    await user.type(input, '  Bob  ')
    await user.click(screen.getByLabelText('Add participant'))

    expect(onAdd).toHaveBeenCalledWith('Bob')
    expect(input).toHaveValue('')
  })

  it('adds via Enter key', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<ParticipantSection participants={[]} onAdd={onAdd} onRemove={vi.fn()} onRename={vi.fn()} onReorder={vi.fn()} />)

    await user.type(screen.getByLabelText('New participant name'), 'Carol{Enter}')
    expect(onAdd).toHaveBeenCalledWith('Carol')
  })

  it('shows an error and does not call onAdd for an empty name', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<ParticipantSection participants={[]} onAdd={onAdd} onRemove={vi.fn()} onRename={vi.fn()} onReorder={vi.fn()} />)

    await user.click(screen.getByLabelText('Add participant'))
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required.')
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('renames a participant by editing the chip and pressing Enter', async () => {
    const onRename = vi.fn()
    const user = userEvent.setup()
    render(<ParticipantSection participants={[alice]} onAdd={vi.fn()} onRemove={vi.fn()} onRename={onRename} onReorder={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Rename Alice' }))
    const editInput = screen.getByLabelText('Rename Alice')
    await user.clear(editInput)
    await user.type(editInput, 'Alicia{Enter}')

    expect(onRename).toHaveBeenCalledWith('a', 'Alicia')
  })

  it('reverts an in-progress rename on Escape without calling onRename', async () => {
    const onRename = vi.fn()
    const user = userEvent.setup()
    render(<ParticipantSection participants={[alice]} onAdd={vi.fn()} onRemove={vi.fn()} onRename={onRename} onReorder={vi.fn()} />)

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
    render(<ParticipantSection participants={[alice]} onAdd={vi.fn()} onRemove={onRemove} onRename={vi.fn()} onReorder={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Remove Alice' }))
    expect(onRemove).toHaveBeenCalledWith('a')
  })
})

describe('ParticipantSection (list layout only)', () => {
  beforeEach(() => {
    setInnerWidth(NARROW_WIDTH)
  })

  function renderList(participants: Participant[]) {
    render(<ParticipantSection participants={participants} onAdd={vi.fn()} onRemove={vi.fn()} onRename={vi.fn()} onReorder={vi.fn()} />)
    return screen.getByRole('list', { name: 'Participants' })
  }

  it('shows one participant per line, in participant order', () => {
    const list = renderList([bob, alice])
    const rows = within(list).getAllByRole('listitem')
    expect(rows.map(r => r.textContent)).toEqual([expect.stringContaining('Bob'), expect.stringContaining('Alice')])
  })

  it('gives each line a drag grip for reordering', () => {
    const list = renderList([alice, bob])
    expect(within(list).getByRole('button', { name: 'Drag to reorder Alice' })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: 'Drag to reorder Bob' })).toBeInTheDocument()
  })

  it('shows no list when there are no participants, only the add field', () => {
    render(<ParticipantSection participants={[]} onAdd={vi.fn()} onRemove={vi.fn()} onRename={vi.fn()} onReorder={vi.fn()} />)
    expect(screen.queryByRole('list', { name: 'Participants' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('New participant name')).toBeInTheDocument()
  })

  it('switches back to chips at the sm breakpoint', () => {
    renderList([alice])
    act(() => setInnerWidth(WIDE_WIDTH))
    expect(screen.queryByRole('list', { name: 'Participants' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Drag to reorder Alice' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rename Alice' })).toBeInTheDocument()
  })
})
