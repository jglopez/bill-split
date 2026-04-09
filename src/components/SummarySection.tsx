import type { AdditionalFee, BillState, Participant } from '../types'
import type { BillBreakdown } from '../utils/calculate'
import { useIsMobile } from '../hooks/useIsMobile'

interface Props {
  orderedParticipants: Participant[]
  additionalFees: AdditionalFee[]
  state: BillState
  breakdown: BillBreakdown
}

/**
 * Read-only summary table showing each person's share of:
 * subtotal → tax → tip → each additional fee → grand total.
 *
 * Columns are rendered in the same order as ItemsTable (controlled by
 * useColumnOrder in App). Per-person values are looked up by participantId
 * rather than relying on parallel index ordering.
 *
 * On narrow screens (below sm breakpoint) each participant is rendered as
 * a stacked card instead of a column in the table.
 *
 * This is intentionally display-only; all interactive inputs live in the
 * sections above. Rendering it separately keeps the component boundary clear
 * and makes it easy to extract into an export/print view later.
 */
export function SummarySection({ orderedParticipants, additionalFees, state, breakdown }: Props) {
  if (orderedParticipants.length === 0 || breakdown.totalSubtotal === 0) return null

  const isMobile = useIsMobile()
  const perPersonMap = new Map(breakdown.perPerson.map(p => [p.participantId, p]))

  function perPersonValue(participantId: string, field: 'subtotal' | 'tax' | 'tip' | 'grandTotal'): number {
    return perPersonMap.get(participantId)?.[field] ?? 0
  }

  function perPersonFee(participantId: string, feeIndex: number): number {
    return perPersonMap.get(participantId)?.additionalFees[feeIndex] ?? 0
  }

  if (isMobile) {
    return (
      <div className="mt-4 space-y-3">
        {orderedParticipants.map(p => {
          const subtotal = perPersonValue(p.id, 'subtotal')
          const tax = perPersonValue(p.id, 'tax')
          const tip = perPersonValue(p.id, 'tip')
          const grandTotal = perPersonValue(p.id, 'grandTotal')
          return (
            <div key={p.id} className="rounded-lg border border-gray-200 px-4 py-3 text-sm">
              <div className="font-medium text-gray-800 mb-2">{p.name}</div>
              <CardRow label="Subtotal" value={subtotal} />
              {breakdown.totalTax !== 0 && (
                <CardRow
                  label={`+ Tax${state.tax ? ` (${state.tax})` : ''}`}
                  value={tax}
                />
              )}
              {breakdown.totalTip !== 0 && (
                <CardRow
                  label={`+ Tip${state.tip ? ` (${state.tip})` : ''}${state.tipBase === 'post-tax' ? ' incl. tax' : ''}`}
                  value={tip}
                />
              )}
              {additionalFees.map((fee, i) => {
                const feeAmount = perPersonFee(p.id, i)
                if (breakdown.totalAdditionalFees[i] === 0) return null
                const isDiscount = feeAmount < 0
                return (
                  <CardRow
                    key={fee.id}
                    label={`${isDiscount ? '−' : '+'} ${fee.name || (isDiscount ? 'Discount' : 'Fee')}${fee.amount ? ` (${fee.amount})` : ''}`}
                    value={feeAmount}
                    isDiscount={isDiscount}
                  />
                )
              })}
              <div className="flex justify-between border-t border-gray-300 mt-2 pt-2 font-semibold text-gray-800">
                <span>Total</span>
                <span className="tabular-nums">{fmt(grandTotal)}</span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="mt-4 overflow-x-auto overscroll-x-none -mx-4 px-4">
      <table className="w-full text-sm border-collapse min-w-[400px]">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-2 pr-3 font-medium text-gray-600 w-[35%]" />
            <th className="text-right py-2 px-2 font-semibold text-gray-700 w-20">Total</th>
            {orderedParticipants.map(p => (
              <th
                key={p.id}
                className="text-right py-2 px-2 font-medium text-gray-600 w-20"
              >
                <span className="block text-xs leading-tight max-w-[70px] ml-auto break-words text-right">
                  {p.name}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Subtotal */}
          <SummaryRow
            label="Subtotal"
            total={breakdown.totalSubtotal}
            values={orderedParticipants.map(p => perPersonValue(p.id, 'subtotal'))}
          />

          {/* Tax */}
          {breakdown.totalTax !== 0 && (
            <SummaryRow
              label={`+ Tax ${state.tax ? `(${state.tax})` : ''}`}
              total={breakdown.totalTax}
              values={orderedParticipants.map(p => perPersonValue(p.id, 'tax'))}
            />
          )}

          {/* Tip */}
          {breakdown.totalTip !== 0 && (
            <SummaryRow
              label={`+ Tip ${state.tip ? `(${state.tip})` : ''}${state.tipBase === 'post-tax' ? ' incl. tax' : ''}`}
              total={breakdown.totalTip}
              values={orderedParticipants.map(p => perPersonValue(p.id, 'tip'))}
            />
          )}

          {/* Additional fees / discounts */}
          {additionalFees.map((fee, i) => {
            const total = breakdown.totalAdditionalFees[i]
            if (total === 0) return null
            const isDiscount = total < 0
            return (
              <SummaryRow
                key={fee.id}
                label={`${isDiscount ? '−' : '+'} ${fee.name || (isDiscount ? 'Discount' : 'Fee')} ${fee.amount ? `(${fee.amount})` : ''}${fee.base === 'post-tax' ? ' incl. tax' : ''}`}
                total={total}
                values={orderedParticipants.map(p => perPersonFee(p.id, i))}
                isDiscount={isDiscount}
              />
            )
          })}

          {/* Grand total */}
          <tr className="border-t-2 border-gray-300 font-semibold">
            <td className="py-2 pr-3 text-gray-800">Grand total</td>
            <td className="py-2 px-2 text-right text-gray-800 tabular-nums">
              {fmt(breakdown.totalGrandTotal)}
            </td>
            {orderedParticipants.map(p => (
              <td key={p.id} className="py-2 px-2 text-right text-gray-800 tabular-nums">
                {fmt(perPersonValue(p.id, 'grandTotal'))}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Mobile card row ──────────────────────────────────────────────────────────

function CardRow({
  label,
  value,
  isDiscount = false,
}: {
  label: string
  value: number
  isDiscount?: boolean
}) {
  const colorClass = isDiscount ? 'text-green-700' : 'text-gray-600'
  return (
    <div className={`flex justify-between py-0.5 text-xs ${colorClass}`}>
      <span>{label}</span>
      <span className="tabular-nums">{fmt(value)}</span>
    </div>
  )
}

// ─── Desktop table row ────────────────────────────────────────────────────────

function SummaryRow({
  label,
  total,
  values,
  isDiscount = false,
}: {
  label: string
  total: number
  values: number[]
  isDiscount?: boolean
}) {
  const colorClass = isDiscount ? 'text-green-700' : 'text-gray-700'
  return (
    <tr className="border-b border-gray-100">
      <td className={`py-1.5 pr-3 ${colorClass} text-xs`}>{label}</td>
      <td className={`py-1.5 px-2 text-right tabular-nums ${colorClass}`}>{fmt(total)}</td>
      {values.map((v, i) => (
        <td key={i} className={`py-1.5 px-2 text-right tabular-nums ${colorClass}`}>
          {fmt(v)}
        </td>
      ))}
    </tr>
  )
}

function fmt(n: number): string {
  // Show negative amounts with an explicit minus sign so meaning isn't
  // conveyed by color alone (WCAG).
  return (n < 0 ? '−' : '') + Math.abs(n).toFixed(2)
}
