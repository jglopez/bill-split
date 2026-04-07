import type { Participant } from '../types'
import type { Transaction } from '../utils/calculate'

interface Props {
  participants: Participant[]
  transactions: Transaction[]
}

/**
 * Displays the minimal set of payments needed to settle the bill.
 *
 * The settlement list is derived by the greedy debt simplification algorithm
 * in calculate.ts. When there are no transactions (e.g. everyone paid their
 * exact share), nothing is rendered.
 */
export function SettlementSection({ participants, transactions }: Props) {
  if (transactions.length === 0) return null

  const nameById = Object.fromEntries(participants.map(p => [p.id, p.name]))

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Settlement
      </h2>
      <ul className="space-y-1 text-sm">
        {transactions.map((t, i) => (
          <li key={i} className="text-gray-700">
            <span className="font-medium">{nameById[t.fromId] ?? '?'}</span>
            {' pays '}
            <span className="font-medium">{nameById[t.toId] ?? '?'}</span>
            {' '}
            <span className="tabular-nums font-semibold text-teal-700">
              ${t.amount.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
