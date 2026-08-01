import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

beforeEach(() => {
  localStorage.clear()
})

async function addParticipant(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByLabelText('New participant name'), name)
  await user.click(screen.getByLabelText('Add participant'))
}

describe('App', () => {
  it('renders the header and an empty items placeholder before any participants exist', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Bill Split' })).toBeInTheDocument()
    expect(screen.getByText('Add participants above to start entering items.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('adding participants reveals the items table and payer section', async () => {
    const user = userEvent.setup()
    render(<App />)
    await addParticipant(user, 'Alice')
    await addParticipant(user, 'Bob')

    expect(screen.getByLabelText('Rename Alice')).toBeInTheDocument()
    expect(screen.getByLabelText('Rename Bob')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByLabelText('Who paid the bill')).toBeInTheDocument()
  })

  it('entering an item price flows through to the summary grand total', async () => {
    const user = userEvent.setup()
    render(<App />)
    await addParticipant(user, 'Alice')
    await addParticipant(user, 'Bob')

    await user.type(screen.getByLabelText('Item description'), 'Dinner')
    await user.type(screen.getAllByLabelText('Item price')[0], '10')

    const grandTotalRow = screen.getByText('Grand total').closest('tr')
    expect(grandTotalRow).not.toBeNull()
    expect(within(grandTotalRow!).getAllByText('5.00')).toHaveLength(2) // $10 split evenly across Alice and Bob
  })

  it('resets all state after confirming the reset modal', async () => {
    const user = userEvent.setup()
    render(<App />)
    await addParticipant(user, 'Alice')
    expect(screen.getByLabelText('Rename Alice')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Reset all fields and start over'))
    expect(screen.getByRole('dialog', { name: 'Reset everything?' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Rename Alice')).toBeInTheDocument() // cancel left state untouched

    await user.click(screen.getByLabelText('Reset all fields and start over'))
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Rename Alice')).not.toBeInTheDocument()
    expect(screen.getByText('Add participants above to start entering items.')).toBeInTheDocument()
  })
})
