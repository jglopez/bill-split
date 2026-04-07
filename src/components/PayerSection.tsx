import type { BillState, Participant, PayerMode } from '../types'
import type { BillBreakdown } from '../utils/calculate'

interface Props {
  participants: Participant[]
  state: BillState
  breakdown: BillBreakdown
  onSetPayerMode: (mode: PayerMode) => void
  onSetSinglePayer: (id: string) => void
  onSetAmountPaid: (participantId: string, value: string) => void
}

/**
 * "Who paid?" section.
 *
 * Single payer mode: one person fronted the entire bill. Rendered as a simple
 * dropdown; amount inputs are hidden.
 *
 * Multiple payers mode: each participant can have an amount they paid entered
 * independently. A soft warning appears when the total paid doesn't match the
 * grand total — this isn't blocked because partial knowledge (e.g. cash vs card)
 * is still useful for splitting.
 */
export function PayerSection({
  participants,
  state,
  breakdown,
  onSetPayerMode,
  onSetSinglePayer,
  onSetAmountPaid,
}: Props) {
  if (participants.length === 0) return null

  const { payerMode, singlePayerId, amountPaid } = state
  const grandTotal = breakdown.totalGrandTotal

  // Soft warning for multiple payer mode when amounts don't add up
  const totalPaid =
    payerMode === 'multiple'
      ? participants.reduce((sum, p) => {
          const val = Number(amountPaid[p.id] ?? '')
          return sum + (isNaN(val) ? 0 : val)
        }, 0)
      : grandTotal

  const mismatch =
    payerMode === 'multiple' && grandTotal > 0 && Math.abs(totalPaid - grandTotal) > 0.01

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Who paid?
      </h2>

      {/* Mode toggle */}
      <div className="flex gap-4 mb-3 text-sm">
        {(['single', 'multiple'] as PayerMode[]).map(mode => (
          <label key={mode} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="payerMode"
              value={mode}
              checked={payerMode === mode}
              onChange={() => onSetPayerMode(mode)}
              className="text-teal-600 focus:ring-teal-500"
            />
            <span className="text-gray-700 capitalize">
              {mode === 'single' ? 'One person' : 'Multiple people'}
            </span>
          </label>
        ))}
      </div>

      {payerMode === 'single' ? (
        /* Single payer dropdown */
        <select
          value={singlePayerId}
          onChange={e => onSetSinglePayer(e.target.value)}
          aria-label="Who paid the bill"
          className="border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent min-h-[44px]"
        >
          {participants.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : (
        /* Multiple payer inputs — one per participant */
        <div className="space-y-2">
          {participants.map(p => {
            const val = amountPaid[p.id] ?? ''
            const numVal = Number(val)
            const invalid = val !== '' && (isNaN(numVal) || numVal < 0)
            return (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <span className="w-32 text-gray-700 truncate">{p.name}</span>
                <span className="text-gray-400">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={val}
                  onChange={e => onSetAmountPaid(p.id, e.target.value)}
                  placeholder="0.00"
                  aria-label={`Amount paid by ${p.name}`}
                  aria-invalid={invalid}
                  className={`w-24 border-b border-dashed focus:outline-none bg-transparent py-0.5 tabular-nums placeholder-gray-300 ${
                    invalid
                      ? 'border-red-400 text-red-600'
                      : 'border-gray-300 focus:border-gray-500 text-gray-800'
                  }`}
                />
                {invalid && (
                  <span role="alert" className="text-xs text-red-600">Invalid amount</span>
                )}
              </div>
            )
          })}

          {mismatch && (
            <p role="status" className="text-xs text-amber-600 mt-1">
              Total paid ({fmt(totalPaid)}) doesn't match the grand total ({fmt(grandTotal)}).
              Settlement will reflect the difference.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function fmt(n: number): string {
  return '$' + n.toFixed(2)
}
