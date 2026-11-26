import { useEffect, useRef, type ReactNode, type Ref } from 'react'
import type { AdditionalFee, BillState, Participant } from '../types'
import type { BillBreakdown, PersonItemShare } from '../utils/calculate'
import { personItemShares, splitAmountInput } from '../utils/calculate'
import { useIsMobile } from '../hooks/useIsMobile'
import { formatAmount } from '../utils/format'
import { describeGroup, summarizeGroup } from '../utils/group'
import { SharePersonButton } from './SharePersonButton'
import { ShareBillTotalButton } from './ShareBillTotalButton'

interface Props {
  participants: Participant[]
  additionalFees: AdditionalFee[]
  state: BillState
  breakdown: BillBreakdown
  /**
   * Where to scroll to, such as what a shared link points at. A
   * `participantId` scrolls to that person and briefly highlights them. A
   * null one means the bill as a whole: on narrow screens it scrolls
   * instantly to the "Bill total" card without highlighting it, and on wide
   * screens, where the table is already in view, it does nothing. `seq`
   * changes on every request, so the same target can be focused twice.
   */
  focus?: { participantId: string | null; seq: number } | null
  /** Called once the highlight is over, or right away when there's nothing to scroll to or highlight. */
  onFocusDone?: () => void
}

/** How long a focused person stays highlighted. */
export const FOCUS_HIGHLIGHT_MS = 2000
/** With reduced motion the highlight appears and disappears without fading, so it stays up a little longer. */
export const FOCUS_HIGHLIGHT_REDUCED_MOTION_MS = 3000

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
 * On narrow screens each person's card has a share icon that sends a link
 * to their share, and the "Bill total" card has one that sends the bare
 * link to the bill. The card is titled "Bill total for <name>" when the
 * bill has a name, cut off with an ellipsis on one line when it's long.
 *
 * A `focus` request scrolls to that person: their card on narrow screens,
 * or the table on wide ones, where their column is tinted instead. A
 * request for no one in particular scrolls to the "Bill total" card, which
 * is what a visitor opening a shared bill should see first: the simplest
 * part of the app, and well away from the draggable lists above it.
 *
 * Display-only; all interactive inputs live in the sections above.
 */
export function SummarySection({ participants, additionalFees, state, breakdown, focus = null, onFocusDone }: Props) {
  const isMobile = useIsMobile()
  // Each person's card, by participant id, so a focus request can find it.
  const cards = useRef(new Map<string, HTMLElement>())
  const table = useRef<HTMLDivElement>(null)
  const billCard = useRef<HTMLElement>(null)
  // The latest callback, so a parent re-render doesn't restart the highlight.
  const onFocusDoneRef = useRef(onFocusDone)
  useEffect(() => {
    onFocusDoneRef.current = onFocusDone
  }, [onFocusDone])

  const hasFocus = focus != null
  const participantId = focus?.participantId ?? null
  const seq = focus?.seq
  useEffect(() => {
    if (!hasFocus) return
    if (participantId === null) {
      // The bill as a whole. Jump rather than animate so a visitor never
      // sees the page start at the top, and leave the card unhighlighted.
      if (isMobile) billCard.current?.scrollIntoView({ behavior: 'auto', block: 'start' })
      onFocusDoneRef.current?.()
      return
    }
    const target = isMobile ? cards.current.get(participantId) : table.current
    if (!target) {
      // Nothing to show this person in (for example a bill with nothing on
      // it yet), so there's nothing to highlight either.
      onFocusDoneRef.current?.()
      return
    }
    const reduced = prefersReducedMotion()
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    const timer = setTimeout(
      () => onFocusDoneRef.current?.(),
      reduced ? FOCUS_HIGHLIGHT_REDUCED_MOTION_MS : FOCUS_HIGHLIGHT_MS,
    )
    return () => clearTimeout(timer)
    // isMobile is left out on purpose: rotating the phone mid-highlight
    // shouldn't scroll again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFocus, participantId, seq])

  if (participants.length === 0 || breakdown.totalSubtotal === 0) return null
  const highlightId = participantId
  const perPersonMap = new Map(breakdown.perPerson.map(p => [p.participantId, p]))

  function perPersonValue(participantId: string, field: 'subtotal' | 'tax' | 'tip' | 'grandTotal'): number {
    return perPersonMap.get(participantId)?.[field] ?? 0
  }

  function perPersonFee(participantId: string, feeIndex: number): number {
    return perPersonMap.get(participantId)?.additionalFees[feeIndex] ?? 0
  }

  if (isMobile) {
    const billName = state.name.trim()
    return (
      <div className="mt-4 space-y-3">
        <SummaryCard
          title={billName ? `Bill total for ${billName}` : 'Bill total'}
          truncateTitle
          cardRef={billCard}
          action={<ShareBillTotalButton state={state} />}
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
            cardRef={el => {
              if (el) cards.current.set(p.id, el)
              else cards.current.delete(p.id)
            }}
            focused={p.id === highlightId}
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
            action={Number.isFinite(perPersonValue(p.id, 'grandTotal')) && (
              <SharePersonButton state={state} participant={p} total={perPersonValue(p.id, 'grandTotal')} />
            )}
          />
        ))}
      </div>
    )
  }

  const highlightIndex = participants.findIndex(p => p.id === highlightId)
  return (
    <div ref={table} className="mt-4 overflow-x-auto overscroll-x-none -mx-4 px-4 scroll-mt-4">
      <table className="w-full text-sm border-collapse min-w-[400px]">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-2 pr-3 font-medium text-gray-600 w-[35%]" />
            <th className="text-right py-2 px-2 font-semibold text-gray-700 w-20">Total</th>
            {participants.map(p => (
              <th
                key={p.id}
                className={`text-right py-2 px-2 font-medium text-gray-600 w-20 ${columnClass(p.id === highlightId)}`}
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
            highlightIndex={highlightIndex}
          />

          {/* Tax */}
          {breakdown.totalTax !== 0 && (
            <SummaryRow
              label={taxLabel(state)}
              total={breakdown.totalTax}
              values={participants.map(p => perPersonValue(p.id, 'tax'))}
              highlightIndex={highlightIndex}
            />
          )}

          {/* Tip */}
          {breakdown.totalTip !== 0 && (
            <SummaryRow
              label={tipLabel(state)}
              total={breakdown.totalTip}
              values={participants.map(p => perPersonValue(p.id, 'tip'))}
              highlightIndex={highlightIndex}
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
                label={feeLabel(fee, isDiscount)}
                total={total}
                values={participants.map(p => perPersonFee(p.id, i))}
                highlightIndex={highlightIndex}
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
              <td key={p.id} className={`py-2 px-2 text-right text-gray-800 tabular-nums ${columnClass(p.id === highlightId)}`}>
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
  truncateTitle = false,
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
  focused = false,
  cardRef,
  action,
}: {
  title: string
  /**
   * Keep the title on one line, cut off with an ellipsis, so a long bill
   * name can't push the card's share icon or the totals around. The full
   * title stays in the tooltip and the card's accessible name.
   */
  truncateTitle?: boolean
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
  /** Briefly ringed when a shared link points at this card's person. */
  focused?: boolean
  cardRef?: Ref<HTMLElement>
  /** A control for the card's top-right corner, such as its share icon. */
  action?: ReactNode
}) {
  const containerClass = highlight
    ? 'border-gray-300 bg-gray-50'
    : 'border-gray-200'
  const focusClass = focused ? 'ring-2 ring-teal-500 ring-offset-2' : 'ring-0'
  return (
    <section
      ref={cardRef}
      aria-label={title}
      data-focused={focused || undefined}
      className={`rounded-lg border px-4 py-3 text-sm scroll-mt-4 transition-shadow duration-700 motion-reduce:transition-none ${containerClass} ${focusClass}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        {truncateTitle
          ? <div title={title} className="min-w-0 font-medium text-gray-800 truncate">{title}</div>
          : <div className="font-medium text-gray-800 [overflow-wrap:anywhere]">{title}</div>}
        {/* The tap target is larger than the glyph; negative margins keep it
            from making the card taller or pushing the title in. */}
        {action && <div className="-mr-3 -my-3 shrink-0">{action}</div>}
      </div>
      {items && items.length > 0 && (
        <ul aria-label={`${title}'s items`} className="border-b border-gray-200 mb-1 pb-1">
          {items.map(line => <ItemLine key={line.itemId} line={line} others={others} />)}
        </ul>
      )}
      <CardRow label="Subtotal" value={subtotal} />
      {breakdown.totalTax !== 0 && (
        <CardRow
          label={taxLabel(state)}
          value={tax}
        />
      )}
      {breakdown.totalTip !== 0 && (
        <CardRow
          label={tipLabel(state)}
          value={tip}
        />
      )}
      {additionalFees.map((fee, i) => {
        if (breakdown.totalAdditionalFees[i] === 0) return null
        const feeAmount = feeAmounts[i] ?? 0
        const isDiscount = breakdown.totalAdditionalFees[i] < 0
        return (
          <CardRow
            key={fee.id}
            label={feeLabel(fee, isDiscount)}
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

// ─── Row labels ───────────────────────────────────────────────────────────────
//
// The desktop table and the mobile cards label their tax, tip, and fee rows
// with these, so both views always word them the same way.

function taxLabel(state: BillState): string {
  return `+ Tax${rateSuffix(state.tax)}`
}

function tipLabel(state: BillState): string {
  return `+ Tip${rateSuffix(state.tip)}${state.tipBase === 'post-tax' ? ' incl. tax' : ''}`
}

/**
 * A fee or discount row label. The caller says which, from the bill's total
 * for that fee, so every view and card words the row the same way, even a
 * card whose share of a discount rounds to zero. A discount's leading "−" already says it's taken off, so its
 * rate drops its own minus sign: "− Coupon (10%)", not "− Coupon (-10%)".
 */
function feeLabel(fee: AdditionalFee, isDiscount: boolean): string {
  const name = fee.name || (isDiscount ? 'Discount' : 'Fee')
  const amount = isDiscount ? fee.amount.trim().replace(/^-\s*/, '') : fee.amount
  return `${isDiscount ? '−' : '+'} ${name}${rateSuffix(amount)}${fee.base === 'post-tax' ? ' incl. tax' : ''}`
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

/** Tints a person's column in the desktop table while a shared link points at them. */
function columnClass(focused: boolean): string {
  return `transition-colors duration-700 motion-reduce:transition-none ${focused ? 'bg-teal-50' : ''}`
}

function SummaryRow({
  label,
  total,
  values,
  isDiscount = false,
  highlightIndex = -1,
}: {
  label: string
  total: number
  values: number[]
  isDiscount?: boolean
  /** The column to tint, by position in `values`, or -1 for none. */
  highlightIndex?: number
}) {
  const colorClass = isDiscount ? 'text-green-700' : 'text-gray-700'
  return (
    <tr className="border-b border-gray-100">
      <td className={`py-1.5 pr-3 ${colorClass} text-xs`}>{label}</td>
      <td className={`py-1.5 px-2 text-right tabular-nums ${colorClass}`}>{formatAmount(total)}</td>
      {values.map((v, i) => (
        <td key={i} data-focused={i === highlightIndex || undefined} className={`py-1.5 px-2 text-right tabular-nums ${colorClass} ${columnClass(i === highlightIndex)}`}>
          {formatAmount(v)}
        </td>
      ))}
    </tr>
  )
}

