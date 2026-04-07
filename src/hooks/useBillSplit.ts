import { useCallback, useEffect, useReducer } from 'react'
import { nanoid } from 'nanoid'
import type { BillState, Item, AdditionalFee, FeesBase, PayerMode } from '../types'

// ─── Default state ────────────────────────────────────────────────────────────

const DEFAULT_STATE: BillState = {
  participants: [],
  items: [{ id: nanoid(), name: '', price: '', assignedTo: [] }],
  tax: '',
  tip: '',
  tipBase: 'pre-tax',
  additionalFees: [],
  payerMode: 'single',
  singlePayerId: '',
  amountPaid: {},
}

// ─── Persistence ──────────────────────────────────────────────────────────────

// The shape stored in localStorage. Versioning this key lets future changes
// to BillState be introduced without silently corrupting existing sessions.
const STORAGE_KEY = 'bill-split:v1'

function loadState(): BillState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as BillState
    // Ensure the trailing blank row always exists after a restore
    return ensureTrailingBlankRow(parsed)
  } catch {
    return DEFAULT_STATE
  }
}

function saveState(state: BillState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage quota exceeded or private browsing — degrade silently.
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'ADD_PARTICIPANT'; name: string }
  | { type: 'REMOVE_PARTICIPANT'; id: string }
  | { type: 'RENAME_PARTICIPANT'; id: string; name: string }
  | { type: 'UPDATE_ITEM'; item: Item }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'SET_TAX'; value: string }
  | { type: 'SET_TIP'; value: string }
  | { type: 'SET_TIP_BASE'; base: FeesBase }
  | { type: 'ADD_FEE' }
  | { type: 'UPDATE_FEE'; fee: AdditionalFee }
  | { type: 'REMOVE_FEE'; id: string }
  | { type: 'SET_PAYER_MODE'; mode: PayerMode }
  | { type: 'SET_SINGLE_PAYER'; id: string }
  | { type: 'SET_AMOUNT_PAID'; participantId: string; value: string }
  | { type: 'RESET' }

/**
 * The last item in the list is always a blank placeholder row.
 * When a user fills it in, a new blank row is appended below it so they can
 * keep adding items without clicking an "Add item" button.
 */
function ensureTrailingBlankRow(state: BillState): BillState {
  const items = state.items
  const last = items[items.length - 1]
  if (!last || last.name !== '' || last.price !== '') {
    return {
      ...state,
      items: [...items, { id: nanoid(), name: '', price: '', assignedTo: [] }],
    }
  }
  return state
}

function reducer(state: BillState, action: Action): BillState {
  switch (action.type) {
    case 'ADD_PARTICIPANT': {
      const id = nanoid()
      return ensureTrailingBlankRow({
        ...state,
        participants: [...state.participants, { id, name: action.name }],
        // Default the new payer to the first participant if none is set
        singlePayerId: state.singlePayerId || id,
      })
    }

    case 'REMOVE_PARTICIPANT': {
      const remaining = state.participants.filter(p => p.id !== action.id)
      // Remove participant from all item assignments
      const items = state.items.map(item => ({
        ...item,
        assignedTo: item.assignedTo.filter(id => id !== action.id),
      }))
      const amountPaid = { ...state.amountPaid }
      delete amountPaid[action.id]
      return ensureTrailingBlankRow({
        ...state,
        participants: remaining,
        items,
        amountPaid,
        // If we removed the single payer, fall back to the first remaining participant
        singlePayerId:
          state.singlePayerId === action.id
            ? (remaining[0]?.id ?? '')
            : state.singlePayerId,
      })
    }

    case 'RENAME_PARTICIPANT':
      return {
        ...state,
        participants: state.participants.map(p =>
          p.id === action.id ? { ...p, name: action.name } : p,
        ),
      }

    case 'UPDATE_ITEM': {
      const exists = state.items.some(i => i.id === action.item.id)
      const items = exists
        ? state.items.map(i => (i.id === action.item.id ? action.item : i))
        : [...state.items, action.item]
      return ensureTrailingBlankRow({ ...state, items })
    }

    case 'REMOVE_ITEM':
      return ensureTrailingBlankRow({
        ...state,
        items: state.items.filter(i => i.id !== action.id),
      })

    case 'SET_TAX':
      return { ...state, tax: action.value }

    case 'SET_TIP':
      return { ...state, tip: action.value }

    case 'SET_TIP_BASE':
      return { ...state, tipBase: action.base }

    case 'ADD_FEE':
      return {
        ...state,
        additionalFees: [
          ...state.additionalFees,
          { id: nanoid(), name: '', amount: '', base: 'pre-tax' },
        ],
      }

    case 'UPDATE_FEE':
      return {
        ...state,
        additionalFees: state.additionalFees.map(f =>
          f.id === action.fee.id ? action.fee : f,
        ),
      }

    case 'REMOVE_FEE':
      return {
        ...state,
        additionalFees: state.additionalFees.filter(f => f.id !== action.id),
      }

    case 'SET_PAYER_MODE':
      return { ...state, payerMode: action.mode }

    case 'SET_SINGLE_PAYER':
      return { ...state, singlePayerId: action.id }

    case 'SET_AMOUNT_PAID':
      return {
        ...state,
        amountPaid: { ...state.amountPaid, [action.participantId]: action.value },
      }

    case 'RESET':
      return DEFAULT_STATE

    default:
      return state
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBillSplit() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  // Persist to localStorage on every state change
  useEffect(() => {
    saveState(state)
  }, [state])

  const addParticipant = useCallback(
    (name: string) => dispatch({ type: 'ADD_PARTICIPANT', name }),
    [],
  )
  const removeParticipant = useCallback(
    (id: string) => dispatch({ type: 'REMOVE_PARTICIPANT', id }),
    [],
  )
  const renameParticipant = useCallback(
    (id: string, name: string) => dispatch({ type: 'RENAME_PARTICIPANT', id, name }),
    [],
  )
  const updateItem = useCallback(
    (item: Item) => dispatch({ type: 'UPDATE_ITEM', item }),
    [],
  )
  const removeItem = useCallback(
    (id: string) => dispatch({ type: 'REMOVE_ITEM', id }),
    [],
  )
  const setTax = useCallback((value: string) => dispatch({ type: 'SET_TAX', value }), [])
  const setTip = useCallback((value: string) => dispatch({ type: 'SET_TIP', value }), [])
  const setTipBase = useCallback(
    (base: FeesBase) => dispatch({ type: 'SET_TIP_BASE', base }),
    [],
  )
  const addFee = useCallback(() => dispatch({ type: 'ADD_FEE' }), [])
  const updateFee = useCallback(
    (fee: AdditionalFee) => dispatch({ type: 'UPDATE_FEE', fee }),
    [],
  )
  const removeFee = useCallback(
    (id: string) => dispatch({ type: 'REMOVE_FEE', id }),
    [],
  )
  const setPayerMode = useCallback(
    (mode: PayerMode) => dispatch({ type: 'SET_PAYER_MODE', mode }),
    [],
  )
  const setSinglePayer = useCallback(
    (id: string) => dispatch({ type: 'SET_SINGLE_PAYER', id }),
    [],
  )
  const setAmountPaid = useCallback(
    (participantId: string, value: string) =>
      dispatch({ type: 'SET_AMOUNT_PAID', participantId, value }),
    [],
  )
  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])

  return {
    state,
    addParticipant,
    removeParticipant,
    renameParticipant,
    updateItem,
    removeItem,
    setTax,
    setTip,
    setTipBase,
    addFee,
    updateFee,
    removeFee,
    setPayerMode,
    setSinglePayer,
    setAmountPaid,
    reset,
  }
}
