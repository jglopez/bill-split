import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettlementSection } from './SettlementSection'
import type { Participant } from '../types'
import type { Transaction } from '../utils/calculate'

const alice: Participant = { id: 'a', name: 'Alice' }
const bob: Participant = { id: 'b', name: 'Bob' }

describe('SettlementSection', () => {
  it('renders nothing when there are no transactions', () => {
    const { container } = render(<SettlementSection participants={[alice, bob]} transactions={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a settlement line per transaction with formatted amounts', () => {
    const transactions: Transaction[] = [{ fromId: 'b', toId: 'a', amount: 5 }]
    render(<SettlementSection participants={[alice, bob]} transactions={transactions} />)
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('pays', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('$5.00')).toBeInTheDocument()
  })

  it('falls back to "?" for a participant id that no longer exists', () => {
    const transactions: Transaction[] = [{ fromId: 'ghost', toId: 'a', amount: 3 }]
    render(<SettlementSection participants={[alice]} transactions={transactions} />)
    expect(screen.getByText('?')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
})
