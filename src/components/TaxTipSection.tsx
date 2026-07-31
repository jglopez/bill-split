import { useId } from 'react'
import type { AdditionalFee, FeesBase, TipDiscountBase, TipFeeBase } from '../types'
import {
  getAmountEquivalent,
  getTotalFeeBase,
  isDiscountAmount,
  isValidAmount,
  parseAmount,
  splitAmountInput,
} from '../utils/calculate'
import { NAME_MAX_LENGTH } from '../constants'

interface Props {
  tax: string
  tip: string
  tipBase: FeesBase
  tipDiscountBase: TipDiscountBase
  tipFeeBase: TipFeeBase
  additionalFees: AdditionalFee[]
  taxableSubtotal: number
  totalSubtotal: number
  // Subtotal net of pre-tax fees/discounts; used for a post-tax fee's own
  // equivalent display so it matches its real calculated amount.
  adjustedTotalSubtotal: number
  // The resolved base tip's own amount is sized against (post tipBase/
  // tipDiscountBase/tipFeeBase); used for tip's equivalent display.
  tipAmountBase: number
  totalTax: number
  onSetTax: (v: string) => void
  onSetTip: (v: string) => void
  onSetTipBase: (b: FeesBase) => void
  onSetTipDiscountBase: (b: TipDiscountBase) => void
  onSetTipFeeBase: (b: TipFeeBase) => void
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
 * ("18%"). The "%" state is controlled by a toggle button next to the input,
 * so the input itself uses inputMode="decimal" for a numeric keypad on mobile.
 * Typing "%" directly in the input is also supported for desktop users.
 */
export function TaxTipSection({
  tax,
  tip,
  tipBase,
  tipDiscountBase,
  tipFeeBase,
  additionalFees,
  taxableSubtotal,
  totalSubtotal,
  adjustedTotalSubtotal,
  tipAmountBase,
  totalTax,
  onSetTax,
  onSetTip,
  onSetTipBase,
  onSetTipDiscountBase,
  onSetTipFeeBase,
  onAddFee,
  onUpdateFee,
  onRemoveFee,
}: Props) {
  const taxInvalid = tax !== '' && !isValidAmount(tax)
  const tipInvalid = tip !== '' && !isValidAmount(tip)
  // Only a genuinely negative/positive parsed amount counts — a freshly
  // added, still-blank fee row (amount: '') would otherwise register as a
  // surcharge (isDiscountAmount('') is false) and prematurely reveal the
  // "after fee" toggle before the user has entered anything.
  const hasPreTaxDiscount = additionalFees.some(
    f => f.base === 'pre-tax' && parseAmount(f.amount, totalSubtotal) < 0,
  )
  const hasPreTaxSurcharge = additionalFees.some(
    f => f.base === 'pre-tax' && parseAmount(f.amount, totalSubtotal) > 0,
  )

  return (
    <div className="space-y-2 mb-4">
      {/* Tax row */}
      <div className="flex items-center gap-2 text-sm">
        <span className="w-24 text-gray-600 shrink-0">+ Tax</span>
        <AmountInput
          value={tax}
          onChange={onSetTax}
          invalid={taxInvalid}
          placeholder="e.g. 10"
          label="Tax amount"
          base={taxableSubtotal}
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
          placeholder="e.g. 20"
          label="Tip amount"
          base={tipAmountBase}
        />
        <IncludeTaxToggle
          base={tipBase}
          onChange={onSetTipBase}
          disabled={!splitAmountInput(tip).isPercent}
        />
        {hasPreTaxDiscount && (
          <BinaryFeeBaseToggle
            checked={tipDiscountBase === 'post-discount'}
            onCheckedChange={checked => onSetTipDiscountBase(checked ? 'post-discount' : 'pre-discount')}
            label="after discount"
            tooltipText="When checked, tip is calculated on the subtotal after pre-tax discounts (e.g. a coupon) are netted out. When unchecked (default), tip is calculated on the full subtotal before discounts, so a discount doesn’t reduce what your server is tipped on."
          />
        )}
        {hasPreTaxSurcharge && (
          <BinaryFeeBaseToggle
            checked={tipFeeBase === 'post-fee'}
            onCheckedChange={checked => onSetTipFeeBase(checked ? 'post-fee' : 'pre-fee')}
            label="after fee"
            tooltipText="When checked, tip is calculated on the subtotal after pre-tax fees/surcharges are netted in. When unchecked (default), tip is calculated before those fees are added, so a surcharge doesn’t inflate what your server is tipped on."
          />
        )}
        {tipInvalid && (
          <span role="alert" className="text-xs text-red-600">Invalid amount</span>
        )}
      </div>

      {/* Additional fees / discounts */}
      {additionalFees.map(fee => (
        <FeeRow
          key={fee.id}
          fee={fee}
          totalSubtotal={totalSubtotal}
          adjustedTotalSubtotal={adjustedTotalSubtotal}
          totalTax={totalTax}
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
  totalSubtotal,
  adjustedTotalSubtotal,
  totalTax,
  onChange,
  onRemove,
}: {
  fee: AdditionalFee
  totalSubtotal: number
  adjustedTotalSubtotal: number
  totalTax: number
  onChange: (fee: AdditionalFee) => void
  onRemove: (id: string) => void
}) {
  const amountInvalid = fee.amount !== '' && !isValidAmount(fee.amount)
  // A pre-tax fee's own amount is sized against the raw subtotal (fees don't
  // cascade off each other); a post-tax fee nets out any pre-tax discount/
  // surcharge already applied, matching calculateBreakdown's totalAdditionalFees.
  const feeBase = getTotalFeeBase(
    fee.base,
    fee.base === 'pre-tax' ? totalSubtotal : adjustedTotalSubtotal,
    totalTax,
  )
  const isDiscount = isDiscountAmount(fee.amount)

  function toggleSign() {
    const t = fee.amount.trim()
    const next = t.startsWith('-') ? t.slice(1) : '-' + t
    onChange({ ...fee, amount: next })
  }

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
        maxLength={NAME_MAX_LENGTH}
        className="border-b border-dashed border-gray-300 focus:border-gray-500 focus:outline-none bg-transparent py-0.5 w-28 text-gray-800 placeholder-gray-300"
      />
      <AmountInput
        value={fee.amount}
        onChange={v => onChange({ ...fee, amount: v })}
        invalid={amountInvalid}
        placeholder="e.g. 5"
        label={`${fee.name || 'fee'} amount`}
        base={feeBase}
      />
      <button
        type="button"
        onClick={toggleSign}
        aria-label={isDiscount ? 'Switch to positive fee' : 'Switch to discount'}
        aria-pressed={isDiscount}
        className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
          isDiscount
            ? 'border-green-500 text-green-700 bg-green-50'
            : 'border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500'
        }`}
      >
        {isDiscount ? '−' : '+/−'}
      </button>
      <IncludeTaxToggle
        base={fee.base}
        onChange={b => onChange({ ...fee, base: b })}
        affectsTaxBase
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
  base,
}: {
  value: string
  onChange: (v: string) => void
  invalid: boolean
  placeholder: string
  label: string
  base?: number
}) {
  // Parse into numeric portion and percent flag.
  // A trailing "%" in the stored value means percent mode is on.
  const { isPercent, numeric } = splitAmountInput(value)
  const equivalent = !invalid && base !== undefined ? getAmountEquivalent(value, base) : null

  function handleInputChange(raw: string) {
    // "%" typed directly acts as a toggle: turns percent mode on if off,
    // off if already on. This mirrors the behavior of the % button.
    const { isPercent: rawIsPercent, numeric: rawNumeric } = splitAmountInput(raw)
    if (rawIsPercent) {
      onChange(rawNumeric + (isPercent ? '' : '%'))
    } else {
      onChange(raw + (isPercent ? '%' : ''))
    }
  }

  function handleTogglePercent() {
    onChange(isPercent ? numeric : numeric + '%')
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="text"
        inputMode="decimal"
        value={numeric}
        onChange={e => handleInputChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={invalid}
        className={`border-b border-dashed focus:outline-none bg-transparent py-0.5 w-20 tabular-nums ${
          invalid
            ? 'border-red-400 text-red-600'
            : 'border-gray-300 focus:border-gray-500 text-gray-800'
        } placeholder-gray-300`}
      />
      <button
        type="button"
        onClick={handleTogglePercent}
        aria-label={isPercent ? 'Switch to dollar amount' : 'Switch to percentage'}
        aria-pressed={isPercent}
        className={`text-xs px-1 py-0.5 rounded border transition-colors ${
          isPercent
            ? 'border-teal-500 text-teal-600 bg-teal-50'
            : 'border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500'
        }`}
      >
        %
      </button>
      {equivalent && (
        <span className="text-xs text-gray-400 tabular-nums">{equivalent}</span>
      )}
    </span>
  )
}

/**
 * Checkbox that controls whether a fee is calculated on the pre-tax subtotal
 * (unchecked, default) or the post-tax subtotal (checked).
 */
function IncludeTaxToggle({
  base,
  onChange,
  disabled = false,
  affectsTaxBase = false,
}: {
  base: FeesBase
  onChange: (b: FeesBase) => void
  disabled?: boolean
  // True for fees/discounts, which adjust the tax base itself when pre-tax.
  // False for tip, which only affects what its own amount is calculated
  // against (and per-person distribution weight), not the tax base.
  affectsTaxBase?: boolean
}) {
  const id = useId()

  if (disabled) {
    return <Tooltip text="Switch to % to calculate this on the pre- or post-tax subtotal." />
  }

  const tooltipText = affectsTaxBase
    ? 'When checked, this is calculated after tax and doesn’t affect the tax owed. When unchecked (default), it’s calculated pre-tax and adjusts the amount tax is charged on.'
    : 'When checked, this is calculated on the subtotal after tax. When unchecked, it uses the pre-tax subtotal.'

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
      <Tooltip text={tooltipText} />
    </span>
  )
}

/**
 * A small checkbox + label + tooltip, shared by the two tip-base toggles
 * above (whether tip nets out a pre-tax discount or surcharge).
 */
function BinaryFeeBaseToggle({
  checked,
  onCheckedChange,
  label,
  tooltipText,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  tooltipText: string
}) {
  const id = useId()

  return (
    <span className="flex items-center gap-1 text-xs text-gray-500">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={e => onCheckedChange(e.target.checked)}
        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
      />
      <label htmlFor={id} className="cursor-pointer select-none">
        {label}
      </label>
      <Tooltip text={tooltipText} />
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
