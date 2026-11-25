import type { AdditionalFee, BillState, Participant } from '../types'
import type { BillBreakdown, PersonItemShare } from '../utils/calculate'
import { personItemShares, splitAmountInput } from '../utils/calculate'
import { useIsMobile } from '../hooks/useIsMobile'
import { formatAmount } from '../utils/format'
import { describeGroup, summarizeGroup } from '../utils/group'

interface Props {
  participants: Participant[]
  additionalFees: AdditionalFee[]
  state: BillState
  breakdown: BillBreakdown
}

/**
 * Read-only summary table showing each person's share of:
 * subtotal → tax → tip → each additional fee → grand total.
 *
 * Columns follow the participant list's order, the same order as the
 * ItemsTable columns. Per-person values are looked up by participantId
 * rather than relying on parallel index ordering.
 *
 * On narrow screens (below sm breakpoint) the table becomes stacked cards:
 * a "Bill total" card first (the equivalent of the table's Total column),
 * then one card per participant. Each participant's card reads like their
 * own itemized receipt: the items they're part of with their share of each,
 * then their subtotal, tax, tip, fees, and total. With a single participant
 * only the "Bill total" card is shown, since their card would be identical.
 *
 * Display-only; all interactive inputs live in the sections above.
 */
export function SummarySection({ participants, additionalFees, state, breakdown }: Props) {
  const isMobile = useIsMobile()

  if (participants.length === 0 || breakdown.totalSubtotal === 0) return null
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
        {/* A lone participant's card would repeat the bill total line for line. */}
        {participants.length > 1 && participants.map(p => (
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
            items={personItemShares(state, p.id, perPersonValue(p.id, 'subtotal'))}
            others={participants.filter(other => other.id !== p.id)}
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
            {participants.map(p => (
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
            values={participants.map(p => perPersonValue(p.id, 'subtotal'))}
          />

          {/* Tax */}
          {breakdown.totalTax !== 0 && (
            <SummaryRow
              label={`+ Tax${rateSuffix(state.tax)}`}
              total={breakdown.totalTax}
              values={participants.map(p => perPersonValue(p.id, 'tax'))}
            />
          )}

          {/* Tip */}
          {breakdown.totalTip !== 0 && (
            <SummaryRow
              label={`+ Tip${rateSuffix(state.tip)}${state.tipBase === 'post-tax' ? ' incl. tax' : ''}`}
              total={breakdown.totalTip}
              values={participants.map(p => perPersonValue(p.id, 'tip'))}
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
                label={`${isDiscount ? '−' : '+'} ${fee.name || (isDiscount ? 'Discount' : 'Fee')}${rateSuffix(fee.amount)}${fee.base === 'post-tax' ? ' incl. tax' : ''}`}
                total={total}
                values={participants.map(p => perPersonFee(p.id, i))}
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
            {participants.map(p => (
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
 * totals so every card lists the same lines. A participant's card also
 * lists their item lines above the subtotal.
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
  items,
  others = [],
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
  items?: PersonItemShare[]
  /** Everyone on the bill but the card's owner, for naming who shares an item. */
  others?: Participant[]
  highlight?: boolean
}) {
  const containerClass = highlight
    ? 'border-gray-300 bg-gray-50'
    : 'border-gray-200'
  return (
    <section aria-label={title} className={`rounded-lg border px-4 py-3 text-sm ${containerClass}`}>
      <div className="font-medium text-gray-800 mb-2 [overflow-wrap:anywhere]">{title}</div>
      {items && items.length > 0 && (
        <ul aria-label={`${title}'s items`} className="border-b border-gray-200 mb-1 pb-1">
          {items.map(line => <ItemLine key={line.itemId} line={line} others={others} />)}
        </ul>
      )}
      <CardRow label="Subtotal" value={subtotal} />
      {breakdown.totalTax !== 0 && (
        <CardRow
          label={`+ Tax${rateSuffix(state.tax)}`}
          value={tax}
        />
      )}
      {breakdown.totalTip !== 0 && (
        <CardRow
          label={`+ Tip${rateSuffix(state.tip)}${state.tipBase === 'post-tax' ? ' incl. tax' : ''}`}
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
            label={`${isDiscount ? '−' : '+'} ${fee.name || (isDiscount ? 'Discount' : 'Fee')}${rateSuffix(fee.amount)}${fee.base === 'post-tax' ? ' incl. tax' : ''}`}
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

/**
 * The rate a tax, tip, or fee was entered as, for a summary label, such as
 * " (8.5%)". A rate is the same for everyone, so it reads correctly next to
 * any person's share. An amount entered in dollars is left out: the bill's
 * own amount already sits beside the label (the table's Total column, or the
 * bill total card), and on a participant's card readers took the bill's
 * full amount for their own.
 */
function rateSuffix(amount: string): string {
  const { isPercent, numeric } = splitAmountInput(amount)
  return isPercent && numeric ? ` (${amount.trim()})` : ''
}

// ─── Mobile item line ─────────────────────────────────────────────────────────

/**
 * One item on a participant's card, with their share of it. A shared item
 * says what it cost in full and who else shares it, such as "18.00 split
 * with Sam and Alex", so the reader can see where their share came from and
 * check who was on it. The card is the owner's own receipt, so the owner
 * isn't named; "everyone" means everyone else on the bill. The caption sits
 * on its own line below the name and amount, so it isn't read as the
 * person's own amount, and it runs the card's full width so a long list of
 * names wraps onto fewer lines. It has no currency symbol, like the rest of
 * the card. Long names wrap rather than truncate, the same as the item cards
 * on phones, and the amount keeps its column.
 */
function ItemLine({ line, others }: { line: PersonItemShare; others: Participant[] }) {
  const name = line.name.trim()
  const caption = line.sharedWith.length > 0 ? `${formatAmount(line.price)} split with ${sharedWithText(line, others)}` : null
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-3 py-0.5 text-xs text-gray-700 [overflow-wrap:anywhere]">
      <span className="min-w-0">
        {name || <span className="italic text-gray-400">Unnamed item</span>}
      </span>
      {caption && <span className="col-span-2 row-start-2 min-w-0 text-gray-400">{caption}</span>}
      <span className="col-start-2 row-start-1 tabular-nums">{formatAmount(line.share)}</span>
    </li>
  )
}

/** Who else shares an item: "Sam and Alex", "everyone", or "everyone but Jo". */
function sharedWithText(line: PersonItemShare, others: Participant[]): string {
  return describeGroup(summarizeGroup(others, p => line.sharedWith.includes(p.id)))
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

