import { useMemo } from 'react'
import { useBillSplit } from './hooks/useBillSplit'
import { calculateBreakdown, calculateSettlement } from './utils/calculate'
import { ParticipantSection } from './components/ParticipantSection'
import { ItemsTable } from './components/ItemsTable'
import { TaxTipSection } from './components/TaxTipSection'
import { SummarySection } from './components/SummarySection'
import { PayerSection } from './components/PayerSection'
import { SettlementSection } from './components/SettlementSection'

export function App() {
  const {
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
  } = useBillSplit()

  // Recalculate on every render. The calculation is fast enough that memoizing
  // by individual field is not necessary, but useMemo avoids recomputing when
  // an unrelated parent re-renders.
  const breakdown = useMemo(() => calculateBreakdown(state), [state])
  const transactions = useMemo(
    () => calculateSettlement(state, breakdown),
    [state, breakdown],
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Bill Split</h1>
          <button
            onClick={reset}
            aria-label="Reset all fields and start over"
            className="text-sm text-gray-400 hover:text-red-500 focus:outline-none focus:text-red-500 transition-colors px-3 py-1.5 rounded border border-transparent hover:border-red-200 focus:border-red-200 min-h-[44px]"
          >
            Reset
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          {/* Participants */}
          <ParticipantSection
            participants={state.participants}
            onAdd={addParticipant}
            onRemove={removeParticipant}
            onRename={renameParticipant}
          />

          {/* Items table */}
          <ItemsTable
            participants={state.participants}
            items={state.items}
            onUpdateItem={updateItem}
            onRemoveItem={removeItem}
          />

          {/* Tax, tip, and additional fees */}
          {state.participants.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <TaxTipSection
                tax={state.tax}
                tip={state.tip}
                tipBase={state.tipBase}
                additionalFees={state.additionalFees}
                onSetTax={setTax}
                onSetTip={setTip}
                onSetTipBase={setTipBase}
                onAddFee={addFee}
                onUpdateFee={updateFee}
                onRemoveFee={removeFee}
              />
            </div>
          )}

          {/* Summary table */}
          <SummarySection
            participants={state.participants}
            additionalFees={state.additionalFees}
            state={state}
            breakdown={breakdown}
          />

          {/* Payer selection */}
          <PayerSection
            participants={state.participants}
            state={state}
            breakdown={breakdown}
            onSetPayerMode={setPayerMode}
            onSetSinglePayer={setSinglePayer}
            onSetAmountPaid={setAmountPaid}
          />

          {/* Settlement */}
          <SettlementSection
            participants={state.participants}
            transactions={transactions}
          />
        </div>
      </div>
    </div>
  )
}
