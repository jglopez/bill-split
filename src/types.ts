export interface Participant {
  id: string
  name: string
}

export interface Item {
  id: string
  name: string
  // Kept as a string so React inputs remain controlled without fighting numeric
  // parsing on every keystroke. Converted to float only when calculating.
  price: string
  // IDs of participants who share this item. An empty array means the item is
  // split equally among all participants; otherwise, this lists the specific
  // participant IDs assigned to the item.
  assignedTo: string[]
}

// Controls whether a proportional fee is calculated on the pre-tax subtotal
// (most common) or on the subtotal after tax has been added.
export type FeesBase = 'pre-tax' | 'post-tax'

// A single surcharge or discount applied proportionally to each person's share.
// Negative amounts are discounts (e.g. a coupon). The same type and math cover
// both cases; the UI distinguishes them visually.
export interface AdditionalFee {
  id: string
  name: string
  // "10%", "5.00", "-10%", or "-5.00". The % suffix signals percentage mode;
  // anything else is treated as a flat dollar amount.
  amount: string
  // Per-fee toggle: whether this fee is based on the pre-tax or post-tax subtotal.
  base: FeesBase
}

export type PayerMode = 'single' | 'multiple'

export interface BillState {
  participants: Participant[]
  items: Item[]
  // Tax is always calculated on the raw item subtotal.
  tax: string
  tip: string
  // Whether tip is applied to the pre-tax or post-tax subtotal.
  tipBase: FeesBase
  // Zero or more additional surcharges/discounts, each with their own base toggle.
  additionalFees: AdditionalFee[]
  // How the bill was paid. 'single': one person fronted everything.
  // 'multiple': each person paid some amount, tracked in amountPaid.
  payerMode: PayerMode
  // Used when payerMode is 'single'.
  singlePayerId: string
  // Used when payerMode is 'multiple'. Maps participant ID → dollar string.
  // Missing entries and empty strings are treated as $0.
  amountPaid: Record<string, string>
}
