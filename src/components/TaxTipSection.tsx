import { useId } from 'react'
import type { AdditionalFee, FeesBase } from '../types'
import { isValidAmount } from '../utils/calculate'

interface Props {
  tax: string
  tip: string
  tipBase: FeesBase
  additionalFees: AdditionalFee[]
  onSetTax: (v: string) => void
  onSetTip: (v: string) => void
  onSetTipBase: (b: FeesBase) => void
  onAddFee: () => void
  onUpdateFee: (fee: AdditionalFee) => void
  onRemoveFee: (id: string) => void
}

/**
 * Tax is always calculated on the raw item subtotal.
 *
 * Tip and additional fees can be calculated on the pre-tax subtotal (most
 * common) or on the post-tax amount (for cases where a vendor has already
 * baked tax into the tip suggestion). Each is toggled independently.
 *
 * A negative fee amount acts as a discount — same proportional math,
 * just reduces each person's share instead of increasing it.
 *
 * Amount fields accept either a plain dollar amount ("15.00") or a percentage
 * ("18%"). The "%" suffix is detected on input so users don't need a separate
 * toggle. These fields use inputMode="text" (not "decimal") to allow the "%"
 * character on mobile keyboards.
 */
export function TaxTipSection({
  tax,
  tip,
  tipBase,
  additionalFees,
  onSetTax,
  onSetTip,
  onSetTipBase,
  onAddFee,
  onUpdateFee,
  onRemoveFee,
}: Props) {
  const taxInvalid = tax !== '' && !isValidAmount(tax)
  const tipInvalid = tip !== '' && !isValidAmount(tip)

  return (
    <div className="space-y-2 mb-4">
      {/* Tax row */}
      <div className="flex items-center gap-2 text-sm">
        <span className="w-24 text-gray-600 shrink-0">+ Tax</span>
        <AmountInput
          value={tax}
          onChange={onSetTax}
          invalid={taxInvalid}
          placeholder="e.g. 10%"
          label="Tax amount"
        />
        {taxInvalid && (
          <span role="alert" className="text-xs text-red-600">Invalid amount</span>
        )}
      </div>

      {/* Tip row */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <span className="w-24 text-gray-600 shrink-0">+ Tip</span>
        <AmountInput
          value={tip}
          onChange={onSetTip}
          invalid={tipInvalid}
          placeholder="e.g. 20%"
          label="Tip amount"
        />
        <IncludeTaxToggle
          base={tipBase}
          onChange={onSetTipBase}
        />
        {tipInvalid && (
          <span role="alert" className="text-xs text-red-600">Invalid amount</span>
        )}
      </div>

      {/* Additional fees / discounts */}
      {additionalFees.map(fee => (
        <FeeRow
          key={fee.id}
          fee={fee}
          onChange={onUpdateFee}
          onRemove={onRemoveFee}
        />
      ))}

      {/* Add fee button */}
      <button
        onClick={onAddFee}
        className="text-sm text-teal-600 hover:text-teal-700 focus:outline-none focus:underline underline-offset-2 min-h-[44px] px-1"
      >
        + Add fee / discount
      </button>
    </div>
  )
}

// ─── Fee row ──────────────────────────────────────────────────────────────────

function FeeRow({
  fee,
  onChange,
  onRemove,
}: {
  fee: AdditionalFee
  onChange: (fee: AdditionalFee) => void
  onRemove: (id: string) => void
}) {
  const amountInvalid = fee.amount !== '' && !isValidAmount(fee.amount)

  // Detect whether the current amount is a discount (negative) so we can
  // label it clearly alongside any visual distinction.
  const trimmedAmount = fee.amount.trim()
  const numAmount = Number(trimmedAmount.endsWith('%') ? trimmedAmount.slice(0, -1) : trimmedAmount)
  const isDiscount = trimmedAmount.startsWith('-') || (!isNaN(numAmount) && numAmount < 0)

  return (
    <div className="flex items-center gap-2 text-sm flex-wrap">
      <span className="w-24 text-gray-600 shrink-0">
        {isDiscount ? (
          <span className="text-green-700">− Discount</span>
        ) : (
          '+ Fee'
        )}
      </span>
      <input
        type="text"
        value={fee.name}
        onChange={e => onChange({ ...fee, name: e.target.value })}
        placeholder="Name"
        aria-label="Fee name"
        className="border-b border-dashed border-gray-300 focus:border-gray-500 focus:outline-none bg-transparent py-0.5 w-28 text-gray-800 placeholder-gray-300"
      />
      <AmountInput
        value={fee.amount}
        onChange={v => onChange({ ...fee, amount: v })}
        invalid={amountInvalid}
        placeholder="e.g. 5% or -5%"
        label={`${fee.name || 'fee'} amount`}
      />
      <IncludeTaxToggle
        base={fee.base}
        onChange={b => onChange({ ...fee, base: b })}
      />
      {amountInvalid && (
        <span role="alert" className="text-xs text-red-600">Invalid amount</span>
      )}
      <button
        onClick={() => onRemove(fee.id)}
        aria-label={`Remove ${fee.name || 'fee'}`}
        className="text-gray-300 hover:text-red-400 focus:outline-none focus:text-red-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function AmountInput({
  value,
  onChange,
  invalid,
  placeholder,
  label,
}: {
  value: string
  onChange: (v: string) => void
  invalid: boolean
  placeholder: string
  label: string
}) {
  return (
    <input
      type="text"
      // "text" instead of "decimal" so the % character is available on mobile
      inputMode="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      aria-invalid={invalid}
      className={`border-b border-dashed focus:outline-none bg-transparent py-0.5 w-24 tabular-nums ${
        invalid
          ? 'border-red-400 text-red-600'
          : 'border-gray-300 focus:border-gray-500 text-gray-800'
      } placeholder-gray-300`}
    />
  )
}

/**
 * Checkbox that controls whether a fee is calculated on the pre-tax subtotal
 * (unchecked, default) or the post-tax subtotal (checked).
 */
function IncludeTaxToggle({
  base,
  onChange,
}: {
  base: FeesBase
  onChange: (b: FeesBase) => void
}) {
  const id = useId()
  return (
    <span className="flex items-center gap-1 text-xs text-gray-500">
      <input
        id={id}
        type="checkbox"
        checked={base === 'post-tax'}
        onChange={e => onChange(e.target.checked ? 'post-tax' : 'pre-tax')}
        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
      />
      <label htmlFor={id} className="cursor-pointer select-none">
        incl. tax
      </label>
      <Tooltip text="When checked, this fee is calculated on the subtotal after tax. When unchecked, it uses the pre-tax subtotal." />
    </span>
  )
}

/**
 * A small accessible help tooltip.
 * Uses a title attribute for screen readers and a hover/focus popover for
 * visual users. Does not rely on color alone to convey meaning.
 */
function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center">
      <button
        type="button"
        aria-label={text}
        title={text}
        className="w-4 h-4 rounded-full border border-gray-300 text-gray-400 text-[10px] leading-none flex items-center justify-center hover:border-gray-500 hover:text-gray-600 focus:outline-none focus:ring-1 focus:ring-teal-400"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block group-focus-within:block w-48 bg-gray-800 text-white text-xs rounded px-2 py-1 z-10 pointer-events-none"
      >
        {text}
      </span>
    </span>
  )
}
