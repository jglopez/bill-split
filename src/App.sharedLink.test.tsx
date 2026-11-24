import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { encodeBillHash, LATEST_LINK_FORMAT } from './share/link/billLink'
import { BILL_HASH_PREFIX } from './share/link/hash'
import { DEFAULT_STATE } from './hooks/useBillSplit'
import { CURRENT_BILL_VERSION } from './lib/migrations'
import type { BillState } from './types'

const shared: BillState = {
  ...DEFAULT_STATE,
  name: 'Shared dinner',
  participants: [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }],
  items: [{ id: 'i', name: 'Pizza', price: '20', assignedTo: null }],
  singlePayerId: 'a',
}

const mine: BillState = { ...DEFAULT_STATE, name: 'My lunch', participants: [{ id: 'z', name: 'Zed' }] }

function visit(hash: string) {
  window.history.replaceState(null, '', `/${hash}`)
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

const billName = () => screen.getByPlaceholderText(/bill name/i)

describe('opening a shared bill link', () => {
  it('opens straight away when the current bill is blank, then clears the address', async () => {
    visit(encodeBillHash(shared))
    render(<App />)
    await screen.findByLabelText('Rename Alice')
    expect(billName()).toHaveValue('Shared dinner')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.location.hash).toBe('')
  })

  it('asks before replacing a bill in progress, and opens it on confirm', async () => {
    localStorage.setItem(`bill-split:v${CURRENT_BILL_VERSION}`, JSON.stringify(mine))
    visit(encodeBillHash(shared))
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('dialog')
    expect(billName()).toHaveValue('My lunch')
    await user.click(screen.getByRole('button', { name: 'Open shared bill' }))

    expect(billName()).toHaveValue('Shared dinner')
    expect(screen.getByLabelText('Rename Bob')).toBeInTheDocument()
    expect(window.location.hash).toBe('')
  })

  it('keeps the current bill when the person declines', async () => {
    localStorage.setItem(`bill-split:v${CURRENT_BILL_VERSION}`, JSON.stringify(mine))
    visit(encodeBillHash(shared))
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Keep mine' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(billName()).toHaveValue('My lunch')
    expect(window.location.hash).toBe('')
  })

  it('says a damaged link could not be opened and leaves the bill alone', async () => {
    localStorage.setItem(`bill-split:v${CURRENT_BILL_VERSION}`, JSON.stringify(mine))
    visit(encodeBillHash(shared).slice(0, 30))
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/incomplete or damaged/)
    expect(billName()).toHaveValue('My lunch')
  })

  it('offers an update for a link from a newer version', async () => {
    visit(`${BILL_HASH_PREFIX}${LATEST_LINK_FORMAT + 1}.AAAA`)
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/newer version/)
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument()
  })

  it('opens a link pasted into the address bar while the app is open', async () => {
    render(<App />)
    visit(encodeBillHash(shared))
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await screen.findByLabelText('Rename Alice')
  })
})
