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

  it('shows the release version and build ID in the footer', () => {
    render(<App />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent(`${__APP_VERSION__} · ${__BUILD_ID__}`)
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

  async function openReset(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    return screen.getByRole('dialog', { name: 'Reset bill' })
  }

  async function fillBill(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Bill name'), 'Dinner')
    await addParticipant(user, 'Alice')
    await user.type(screen.getByLabelText('Item description'), 'Taco')
    await user.type(screen.getAllByLabelText('Item price')[0], '10')
  }

  it('Cancel and Escape close the reset modal without changing anything', async () => {
    const user = userEvent.setup()
    render(<App />)
    await fillBill(user)

    await openReset(user)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await openReset(user)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    expect(screen.getByLabelText('Bill name')).toHaveValue('Dinner')
    expect(screen.getByLabelText('Rename Alice')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Item description')[0]).toHaveValue('Taco')
  })

  it('Reset all clears the whole bill', async () => {
    const user = userEvent.setup()
    render(<App />)
    await fillBill(user)

    await openReset(user)
    await user.click(screen.getByRole('button', { name: 'Reset all' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Bill name')).toHaveValue('')
    expect(screen.queryByLabelText('Rename Alice')).not.toBeInTheDocument()
    expect(screen.getByText('Add participants above to start entering items.')).toBeInTheDocument()
  })

  it('Clear participants keeps the items and the bill name', async () => {
    const user = userEvent.setup()
    render(<App />)
    await fillBill(user)

    await openReset(user)
    await user.click(screen.getByRole('button', { name: 'Clear participants' }))
    expect(screen.getByLabelText('Bill name')).toHaveValue('Dinner')
    expect(screen.queryByLabelText('Rename Alice')).not.toBeInTheDocument()
    expect(screen.getByText('1 item is kept. Add participants above to split it.')).toBeInTheDocument()

    // The items reappear once someone is added again.
    await addParticipant(user, 'Bob')
    expect(screen.getAllByLabelText('Item description')[0]).toHaveValue('Taco')
  })

  it('Clear items keeps the participants and clears the bill name', async () => {
    const user = userEvent.setup()
    render(<App />)
    await fillBill(user)

    await openReset(user)
    await user.click(screen.getByRole('button', { name: 'Clear items' }))
    expect(screen.getByLabelText('Bill name')).toHaveValue('')
    expect(screen.getByLabelText('Rename Alice')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Item description')).toHaveLength(1)
    expect(screen.getByLabelText('Item description')).toHaveValue('')
  })

  it('keeps the bill name across a reload', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await user.type(screen.getByLabelText('Bill name'), 'Dinner')
    unmount()

    render(<App />)
    expect(screen.getByLabelText('Bill name')).toHaveValue('Dinner')
  })

  it('offers the summary and the link only once there is a bill to share', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.queryByRole('button', { name: /summary|link/ })).not.toBeInTheDocument()

    await addParticipant(user, 'Alice')
    expect(screen.queryByRole('button', { name: /summary|link/ })).not.toBeInTheDocument()

    await user.type(screen.getAllByLabelText('Item price')[0], '10')
    const share = screen.getByRole('region', { name: 'Share' })
    expect(within(share).getByRole('button', { name: 'Copy summary' })).toBeInTheDocument()
    expect(within(share).getByRole('button', { name: /^(Share|Copy) link$/ })).toBeInTheDocument()
  })

  it('hides the summary when the totals are not real numbers', async () => {
    const user = userEvent.setup()
    render(<App />)
    await addParticipant(user, 'Alice')
    // Too large for a double, so the totals overflow to Infinity or NaN.
    await user.type(screen.getAllByLabelText('Item price')[0], '1e400')
    expect(screen.queryByRole('button', { name: /summary|link/ })).not.toBeInTheDocument()
  })
})
