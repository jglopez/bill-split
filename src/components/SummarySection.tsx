import type { AdditionalFee, BillState, Participant } from '../types'
import type { BillBreakdown } from '../utils/calculate'
import { useIsMobile } from '../hooks/useIsMobile'
import { formatAmount } from '../utils/format'

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
 * On narrow screens (below sm breakpoint) the table becomes stacked cards:
 * a "Bill total" card first (the equivalent of the table's Total column),
 * then one card per participant.
 *
 * Display-only; all interactive inputs live in the sections above.
 */
export function SummarySection({ orderedParticipants, additionalFees, state, breakdown }: Props) {
  const isMobile = useIsMobile()

  if (orderedParticipants.length === 0 || breakdown.totalSubtotal === 0) return null
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
        <SummaryCard
          title="Bill total"
          totalLabel="Grand total"
          subtotal={breakdown.totalSubtotal}
          tax={breakdown.totalTax}
          tip={breakdown.totalTip}
          feeAmounts={breakdown.totalAdditionalFees}
          total={breakdown.totalGrandTotal}
          state={state}
          additionalFees={additionalFees}
          breakdown={breakdown}
          highlight
        />
        {orderedParticipants.map(p => (
          <SummaryCard
            key={p.id}
            title={p.name}
            totalLabel="Total"
            subtotal={perPersonValue(p.id, 'subtotal')}
            tax={perPersonValue(p.id, 'tax')}
            tip={perPersonValue(p.id, 'tip')}
            feeAmounts={additionalFees.map((_, i) => perPersonFee(p.id, i))}
            total={perPersonValue(p.id, 'grandTotal')}
            state={state}
            additionalFees={additionalFees}
            breakdown={breakdown}
          />
        ))}
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
              {formatAmount(breakdown.totalGrandTotal)}
            </td>
            {orderedParticipants.map(p => (
              <td key={p.id} className="py-2 px-2 text-right text-gray-800 tabular-nums">
                {formatAmount(perPersonValue(p.id, 'grandTotal'))}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Mobile card ──────────────────────────────────────────────────────────────

/**
 * One stacked card in the mobile summary: either the whole bill or a single
 * participant's share. Rows are shown or hidden based on the bill-level
 * totals so every card lists the same lines.
 */
function SummaryCard({
  title,
  totalLabel,
  subtotal,
  tax,
  tip,
  feeAmounts,
  total,
  state,
  additionalFees,
  breakdown,
  highlight = false,
}: {
  title: string
  totalLabel: string
  subtotal: number
  tax: number
  tip: number
  feeAmounts: number[]
  total: number
  state: BillState
  additionalFees: AdditionalFee[]
  breakdown: BillBreakdown
  highlight?: boolean
}) {
  const containerClass = highlight
    ? 'border-gray-300 bg-gray-50'
    : 'border-gray-200'
  return (
    <section aria-label={title} className={`rounded-lg border px-4 py-3 text-sm ${containerClass}`}>
      <div className="font-medium text-gray-800 mb-2">{title}</div>
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
        if (breakdown.totalAdditionalFees[i] === 0) return null
        const feeAmount = feeAmounts[i] ?? 0
        const isDiscount = feeAmount < 0
        return (
          <CardRow
            key={fee.id}
            label={`${isDiscount ? '−' : '+'} ${fee.name || (isDiscount ? 'Discount' : 'Fee')}${fee.amount ? ` (${fee.amount})` : ''}${fee.base === 'post-tax' ? ' incl. tax' : ''}`}
            value={feeAmount}
            isDiscount={isDiscount}
          />
        )
      })}
      <div className="flex justify-between border-t border-gray-300 mt-2 pt-2 font-semibold text-gray-800">
        <span>{totalLabel}</span>
        <span className="tabular-nums">{formatAmount(total)}</span>
      </div>
    </section>
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
      <span className="tabular-nums">{formatAmount(value)}</span>
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
      <td className={`py-1.5 px-2 text-right tabular-nums ${colorClass}`}>{formatAmount(total)}</td>
      {values.map((v, i) => (
        <td key={i} className={`py-1.5 px-2 text-right tabular-nums ${colorClass}`}>
          {formatAmount(v)}
        </td>
      ))}
    </tr>
  )
}

