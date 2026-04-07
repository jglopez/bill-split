import type { Item, Participant } from '../types'
import { isValidPrice } from '../utils/calculate'

interface Props {
  participants: Participant[]
  items: Item[]
  onUpdateItem: (item: Item) => void
  onRemoveItem: (id: string) => void
}

/**
 * Spreadsheet-style table where each row is a line item.
 *
 * The last row is always a blank placeholder. When the user types in it a new
 * blank row is automatically appended below — this avoids the need for an
 * explicit "Add item" button while keeping the interaction familiar.
 *
 * The checkbox on each row controls item assignment:
 *   - Checked   → item is split among all current participants
 *   - Unchecked → only the individually checked column checkboxes are assigned
 *
 * assignedTo stores IDs (not names) so renaming a participant doesn't break
 * existing assignments.
 */
export function ItemsTable({ participants, items, onUpdateItem, onRemoveItem }: Props) {
  if (participants.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic mb-6">
        Add participants above to start entering items.
      </p>
    )
  }

  const allIds = participants.map(p => p.id)

  function isAssignedToAll(item: Item): boolean {
    if (item.assignedTo.length === 0) return true
    return allIds.every(id => item.assignedTo.includes(id))
  }

  function toggleAllAssigned(item: Item) {
    if (item.assignedTo.length === 0) {
      // Sentinel "all" → convert to an explicit full list so individual
      // per-person checkboxes can be unchecked independently afterward.
      onUpdateItem({ ...item, assignedTo: [...allIds] })
    } else {
      // Explicit list (full or partial) → collapse back to sentinel "all".
      onUpdateItem({ ...item, assignedTo: [] })
    }
  }

  function toggleParticipant(item: Item, participantId: string) {
    const current =
      item.assignedTo.length === 0 ? allIds : [...item.assignedTo]
    const next = current.includes(participantId)
      ? current.filter(id => id !== participantId)
      : [...current, participantId]
    onUpdateItem({ ...item, assignedTo: next })
  }

  function isParticipantAssigned(item: Item, participantId: string): boolean {
    if (item.assignedTo.length === 0) return true
    return item.assignedTo.includes(participantId)
  }

  function handleNameChange(item: Item, name: string) {
    onUpdateItem({ ...item, name })
  }

  function handlePriceChange(item: Item, price: string) {
    onUpdateItem({ ...item, price })
  }

  const isLastRow = (item: Item) => item === items[items.length - 1]

  return (
    <div className="mb-2 overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm border-collapse min-w-[500px]">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 pr-3 font-medium text-gray-600 w-[35%]">Item</th>
            <th className="text-right py-2 px-2 font-medium text-gray-600 w-20">$</th>
            {participants.map(p => (
              <th key={p.id} className="text-center py-2 px-1 font-medium text-gray-600 w-20">
                <span className="block text-xs leading-tight max-w-[70px] mx-auto break-words">
                  {p.name}
                </span>
              </th>
            ))}
            {/* "All" column header */}
            <th className="text-center py-2 px-2 font-medium text-gray-400 text-xs w-12">all</th>
            {/* Delete column — only needed when there are removable rows */}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const blank = isLastRow(item)
            const priceInvalid = item.price !== '' && !isValidPrice(item.price)

            return (
              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                {/* Item name */}
                <td className="py-1 pr-3">
                  <input
                    type="text"
                    value={item.name}
                    onChange={e => handleNameChange(item, e.target.value)}
                    placeholder={blank ? 'Description' : ''}
                    aria-label="Item description"
                    className="w-full bg-transparent border-0 border-b border-dashed border-gray-300 focus:border-gray-500 focus:outline-none py-0.5 placeholder-gray-300 text-gray-800"
                  />
                </td>

                {/* Price */}
                <td className="py-1 px-2 text-right">
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.price}
                      onChange={e => handlePriceChange(item, e.target.value)}
                      placeholder="0.00"
                      aria-label="Item price"
                      aria-invalid={priceInvalid}
                      className={`w-16 text-right bg-transparent border-0 border-b border-dashed focus:outline-none py-0.5 placeholder-gray-300 ${
                        priceInvalid
                          ? 'border-red-400 text-red-600'
                          : 'border-gray-300 focus:border-gray-500 text-gray-800'
                      }`}
                    />
                    {priceInvalid && (
                      <span role="alert" className="sr-only">
                        Invalid price
                      </span>
                    )}
                  </div>
                </td>

                {/* Per-participant column cells */}
                {participants.map(p => {
                  const assigned = isParticipantAssigned(item, p.id)
                  const price = Number(item.price)
                  const assignedCount =
                    item.assignedTo.length === 0
                      ? participants.length
                      : item.assignedTo.length
                  const share =
                    assigned && !isNaN(price) && price > 0 && assignedCount > 0
                      ? price / assignedCount
                      : 0

                  return (
                    <td key={p.id} className="py-1 px-1 text-center">
                      {blank ? (
                        <span className="text-gray-300 text-xs">—</span>
                      ) : (
                        <label className="flex flex-col items-center gap-0.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={assigned}
                            onChange={() => toggleParticipant(item, p.id)}
                            aria-label={`Assign "${item.name || 'item'}" to ${p.name}`}
                            className="sr-only"
                          />
                          <span
                            aria-hidden="true"
                            className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                              assigned
                                ? 'bg-teal-600 border-teal-600 text-white'
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            {assigned && <CheckIcon />}
                          </span>
                          <span className="text-xs text-gray-600 tabular-nums">
                            {share > 0 ? fmt(share) : <span className="text-gray-300">—</span>}
                          </span>
                        </label>
                      )}
                    </td>
                  )
                })}

                {/* "All" toggle checkbox */}
                <td className="py-1 px-2 text-center">
                  {blank ? null : (
                    <label className="cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAssignedToAll(item)}
                        onChange={() => toggleAllAssigned(item)}
                        aria-label={`Assign "${item.name || 'item'}" to all participants`}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`inline-flex w-5 h-5 rounded items-center justify-center border transition-colors ${
                          isAssignedToAll(item)
                            ? 'bg-teal-600 border-teal-600 text-white'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isAssignedToAll(item) && <CheckIcon />}
                      </span>
                    </label>
                  )}
                </td>

                {/* Delete button — hidden for the blank placeholder row */}
                <td className="py-1 text-center">
                  {!blank && (
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      aria-label={`Remove "${item.name || 'item'}"`}
                      className="text-gray-300 hover:text-red-400 focus:outline-none focus:text-red-400 transition-colors p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toFixed(2)
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 10 8"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3 h-3"
      aria-hidden="true"
    >
      <polyline points="1,4 3.5,7 9,1" />
    </svg>
  )
}
