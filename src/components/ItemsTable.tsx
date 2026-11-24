import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Item, Participant } from '../types'
import { isValidPrice } from '../utils/calculate'
import { formatAmount } from '../utils/format'
import { NAME_MAX_LENGTH } from '../constants'
import { useIsMobile } from '../hooks/useIsMobile'

function isParticipantAssigned(item: Item, participantId: string): boolean {
  if (item.assignedTo === null) return true
  return item.assignedTo.includes(participantId)
}

function getItemShare(item: Item, participantId: string, allParticipantCount: number): number {
  const assigned = isParticipantAssigned(item, participantId)
  const price = Number(item.price)
  const assignedCount = item.assignedTo === null ? allParticipantCount : item.assignedTo.length
  return assigned && !isNaN(price) && price > 0 && assignedCount > 0
    ? price / assignedCount
    : 0
}

interface Props {
  participants: Participant[]
  items: Item[]
  onUpdateItem: (item: Item) => void
  onRemoveItem: (id: string) => void
  onReorderItems: (fromIndex: number, toIndex: number) => void
  onReorderColumns: (fromIndex: number, toIndex: number) => void
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
 *
 * Columns (participants) can be reordered by dragging the column header.
 * Rows (items) can be reordered by dragging the grip handle on the left.
 * Both update BillState directly. Column order is the participant list's
 * order, so every other view and share method follows it.
 *
 * On narrow screens (below the sm breakpoint) each row becomes a stacked
 * card instead, so nothing needs horizontal scrolling: description, price
 * and remove on top, then a wrapping line of assignment chips ("All" and one
 * per participant, showing that person's share) ending with the taxable
 * switch. The cards keep row dragging by the grip. Participants can't be
 * reordered there, because the cards have no columns to drag.
 */
export function ItemsTable({ participants, items, onUpdateItem, onRemoveItem, onReorderItems, onReorderColumns }: Props) {
  const allIds = participants.map(p => p.id)
  const isMobile = useIsMobile()

  const [activeColumnId, setActiveColumnId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const collisionDetection: CollisionDetection = (args) => {
    if (activeColumnId !== null) {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          c => c.data.current?.type === 'column',
        ),
      })
    }
    return closestCenter(args)
  }

  function handleDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === 'column') {
      setActiveColumnId(event.active.id as string)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveColumnId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeType = active.data.current?.type as string | undefined
    const overType = over.data.current?.type as string | undefined

    if (activeType === 'column' && overType === 'column') {
      const oldIdx = allIds.indexOf(active.id as string)
      const newIdx = allIds.indexOf(over.id as string)
      if (oldIdx !== -1 && newIdx !== -1) {
        onReorderColumns(oldIdx, newIdx)
      }
    } else if (activeType === 'row' && overType === 'row') {
      const draggable = items.slice(0, -1) // exclude trailing blank row
      const oldIdx = draggable.findIndex(i => i.id === active.id)
      const newIdx = draggable.findIndex(i => i.id === over.id)
      if (oldIdx !== -1 && newIdx !== -1) {
        onReorderItems(oldIdx, newIdx)
      }
    }
  }

  if (participants.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic mb-6">
        Add participants above to start entering items.
      </p>
    )
  }

  function isAssignedToAll(item: Item): boolean {
    if (item.assignedTo === null) return true
    return allIds.length > 0 && allIds.every(id => (item.assignedTo ?? []).includes(id))
  }

  function toggleAllAssigned(item: Item) {
    if (isAssignedToAll(item)) {
      // All assigned → deselect everyone so the user can pick individuals
      onUpdateItem({ ...item, assignedTo: [] })
    } else {
      // None or partial → assign all via sentinel (picks up future participant adds automatically)
      onUpdateItem({ ...item, assignedTo: null })
    }
  }

  function toggleParticipant(item: Item, participantId: string) {
    const current = item.assignedTo === null ? allIds : [...item.assignedTo]
    const next = current.includes(participantId)
      ? current.filter(id => id !== participantId)
      : [...current, participantId]
    onUpdateItem({ ...item, assignedTo: next })
  }

  const isLastRow = (item: Item) => item === items[items.length - 1]

  if (isMobile) {
    return (
      <div className="mb-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <ul aria-label="Items" className="space-y-2">
              {items.map(item => {
                const blank = isLastRow(item)
                return (
                  <SortableItemCard key={item.id} id={item.id} isBlank={blank}>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 min-w-0">
                        <ItemNameInput item={item} isBlank={blank} onUpdateItem={onUpdateItem} />
                      </div>
                      <ItemPriceInput item={item} onUpdateItem={onUpdateItem} className="w-20" />
                      {blank
                        ? <span aria-hidden="true" className="w-11 flex-shrink-0" /> // keeps prices aligned with item cards
                        : <RemoveItemButton item={item} onRemoveItem={onRemoveItem} />}
                    </div>
                    {!blank && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <AssignChip
                          label="All"
                          checked={isAssignedToAll(item)}
                          onChange={() => toggleAllAssigned(item)}
                          ariaLabel={`Assign "${item.name || 'item'}" to all participants`}
                        />
                        {participants.map(p => (
                          <AssignChip
                            key={p.id}
                            label={p.name}
                            checked={isParticipantAssigned(item, p.id)}
                            share={getItemShare(item, p.id, participants.length)}
                            onChange={() => toggleParticipant(item, p.id)}
                            ariaLabel={`Assign "${item.name || 'item'}" to ${p.name}`}
                          />
                        ))}
                        <div className="ml-auto">
                          <TaxableSwitch item={item} onUpdateItem={onUpdateItem} showLabel />
                        </div>
                      </div>
                    )}
                  </SortableItemCard>
                )
              })}
            </ul>
          </SortableContext>
        </DndContext>
      </div>
    )
  }

  return (
    <div className="mb-2 overflow-x-auto overscroll-x-none -mx-4 px-4">
      <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <table className="w-full text-sm border-collapse min-w-[500px]">
          <thead>
            <tr className="border-b border-gray-200">
              {/* Drag handle column — header is blank */}
              <th className="w-6" />
              <th className="text-left py-2 pr-3 font-medium text-gray-600 w-[35%]">Item</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600 w-20">$</th>
              <th className="text-center py-2 px-2 font-medium text-gray-400 text-xs w-14">taxable</th>
              <SortableContext items={allIds} strategy={horizontalListSortingStrategy}>
                {participants.map(p => (
                  <SortableColumnHeader key={p.id} participant={p} />
                ))}
              </SortableContext>
              <th className="text-center py-2 px-2 font-medium text-gray-400 text-xs w-12">all</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              {items.map((item) => {
                const blank = isLastRow(item)

                return (
                  <SortableItemRow key={item.id} id={item.id} isBlank={blank}>
                    {/* Item name */}
                    <td className="py-1 pr-3">
                      <ItemNameInput item={item} isBlank={blank} onUpdateItem={onUpdateItem} />
                    </td>

                    {/* Price */}
                    <td className="py-1 px-2 text-right">
                      <ItemPriceInput item={item} onUpdateItem={onUpdateItem} className="w-16" />
                    </td>

                    {/* Taxable toggle switch */}
                    <td className="py-1 px-2 text-center">
                      {blank ? null : <TaxableSwitch item={item} onUpdateItem={onUpdateItem} />}
                    </td>

                    {/* Per-participant column cells — rendered in column display order */}
                    {participants.map(p => {
                      const assigned = isParticipantAssigned(item, p.id)
                      const share = getItemShare(item, p.id, participants.length)

                      return (
                        <td key={p.id} className="py-1 px-1 text-center" style={{ opacity: activeColumnId === p.id ? 0.4 : undefined }}>
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
                                {share > 0 ? formatAmount(share) : <span className="text-gray-300">—</span>}
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
                      {!blank && <RemoveItemButton item={item} onRemoveItem={onRemoveItem} />}
                    </td>
                  </SortableItemRow>
                )
              })}
            </SortableContext>
          </tbody>
        </table>
        <DragOverlay>
          {activeColumnId && (() => {
            const participant = participants.find(p => p.id === activeColumnId)
            if (!participant) return null
            return <ColumnDragOverlay participant={participant} items={items} participants={participants} />
          })()}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ─── Column drag overlay ──────────────────────────────────────────────────────

function ColumnDragOverlay({
  participant,
  items,
  participants,
}: {
  participant: Participant
  items: Item[]
  participants: Participant[]
}) {
  const displayItems = items.slice(0, -1) // exclude trailing blank row
  return (
    <div className="bg-white shadow-xl rounded border border-gray-300 w-20 overflow-hidden">
      <div className="text-center py-2 px-1 border-b-2 border-gray-200">
        <span className="block text-xs leading-tight max-w-[70px] mx-auto break-words font-medium text-gray-600">
          {participant.name}
        </span>
      </div>
      {displayItems.map(item => {
        const assigned = isParticipantAssigned(item, participant.id)
        const share = getItemShare(item, participant.id, participants.length)
        return (
          <div key={item.id} className="py-1 px-1 text-center border-b border-gray-100 flex flex-col items-center gap-0.5">
            <span
              className={`w-5 h-5 rounded flex items-center justify-center border ${
                assigned ? 'bg-teal-600 border-teal-600 text-white' : 'border-gray-300 bg-white'
              }`}
            >
              {assigned && <CheckIcon />}
            </span>
            <span className="text-xs text-gray-600 tabular-nums">
              {share > 0 ? formatAmount(share) : <span className="text-gray-300">—</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Sortable column header ───────────────────────────────────────────────────

function SortableColumnHeader({ participant }: { participant: Participant }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: participant.id,
    data: { type: 'column' },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  }

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="text-center py-2 px-1 font-medium text-gray-600 w-20"
    >
      <span
        className="block text-xs leading-tight max-w-[70px] mx-auto break-words cursor-grab active:cursor-grabbing select-none"
        {...attributes}
        {...listeners}
      >
        {participant.name}
      </span>
    </th>
  )
}

// ─── Sortable item row ────────────────────────────────────────────────────────

function SortableItemRow({
  id,
  isBlank,
  children,
}: {
  id: string
  isBlank: boolean
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'row' },
    disabled: isBlank,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-gray-100 hover:bg-gray-50"
    >
      <td className="py-1 w-6 text-center">
        {!isBlank && (
          <button
            className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none focus:outline-none p-1"
            aria-label="Drag to reorder item"
            {...attributes}
            {...listeners}
          >
            <GripIcon />
          </button>
        )}
      </td>
      {children}
    </tr>
  )
}

// ─── Sortable item card (narrow screens) ──────────────────────────────────────

function SortableItemCard({
  id,
  isBlank,
  children,
}: {
  id: string
  isBlank: boolean
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'row' },
    disabled: isBlank,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex gap-1 rounded-lg border bg-white py-1 pr-1 text-sm ${
        isBlank ? 'border-dashed border-gray-200' : 'border-gray-200'
      }`}
    >
      {/* Keeps the grip's width on the blank card so descriptions line up. */}
      <div className="w-8 flex-shrink-0 flex items-start justify-center">
        {!isBlank && (
          <button
            className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none focus:outline-none min-h-11 w-8 flex items-center justify-center"
            aria-label="Drag to reorder item"
            {...attributes}
            {...listeners}
          >
            <GripIcon />
          </button>
        )}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </li>
  )
}

/**
 * A tappable participant (or "All") pill for the narrow layout. The real
 * checkbox is visually hidden; the pill is its label, so the whole pill is
 * the touch target.
 */
function AssignChip({
  label,
  checked,
  share,
  onChange,
  ariaLabel,
}: {
  label: string
  checked: boolean
  share?: number
  onChange: () => void
  ariaLabel: string
}) {
  return (
    <label
      className={`inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border px-2.5 cursor-pointer select-none transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-500 ${
        checked ? 'border-teal-600 bg-teal-50 text-gray-800' : 'border-gray-300 bg-white text-gray-500'
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={ariaLabel} className="sr-only" />
      <span
        aria-hidden="true"
        className={`w-4 h-4 flex-shrink-0 rounded flex items-center justify-center border ${
          checked ? 'bg-teal-600 border-teal-600 text-white' : 'border-gray-300 bg-white'
        }`}
      >
        {checked && <CheckIcon />}
      </span>
      <span className="min-w-0 truncate">{label}</span>
      {share !== undefined && share > 0 && (
        <span className="text-xs text-gray-600 tabular-nums">{formatAmount(share)}</span>
      )}
    </label>
  )
}

// ─── Inputs shared by both layouts ────────────────────────────────────────────

function ItemNameInput({
  item,
  isBlank,
  onUpdateItem,
}: {
  item: Item
  isBlank: boolean
  onUpdateItem: (item: Item) => void
}) {
  return (
    <input
      type="text"
      value={item.name}
      onChange={e => onUpdateItem({ ...item, name: e.target.value })}
      placeholder={isBlank ? 'Description' : ''}
      aria-label="Item description"
      maxLength={NAME_MAX_LENGTH}
      className="w-full bg-transparent border-0 border-b border-dashed border-gray-300 focus:border-gray-500 focus:outline-none py-0.5 placeholder-gray-300 text-gray-800"
    />
  )
}

function ItemPriceInput({
  item,
  onUpdateItem,
  className,
}: {
  item: Item
  onUpdateItem: (item: Item) => void
  /** Width of the field; the layouts size it differently. */
  className: string
}) {
  const priceInvalid = item.price !== '' && !isValidPrice(item.price)
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={item.price}
        onChange={e => onUpdateItem({ ...item, price: e.target.value })}
        placeholder="0.00"
        aria-label="Item price"
        aria-invalid={priceInvalid}
        className={`${className} text-right bg-transparent border-0 border-b border-dashed focus:outline-none py-0.5 placeholder-gray-300 ${
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
  )
}

/**
 * Taxable on/off switch. In the table the column header names it; the card
 * layout has no header, so it shows a short visible label and a full-size
 * touch target instead.
 */
function TaxableSwitch({
  item,
  onUpdateItem,
  showLabel = false,
}: {
  item: Item
  onUpdateItem: (item: Item) => void
  showLabel?: boolean
}) {
  const taxable = item.taxable !== false
  return (
    <button
      role="switch"
      aria-checked={taxable}
      aria-label={`Taxable: "${item.name || 'item'}"`}
      onClick={() => onUpdateItem({ ...item, taxable: taxable ? false : undefined })}
      className={`group inline-flex items-center gap-1 align-middle rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
        showLabel ? 'min-h-11 px-1' : ''
      }`}
    >
      {showLabel && <span className="text-xs text-gray-400">tax</span>}
      <span
        aria-hidden="true"
        className={`relative inline-flex h-4 w-7 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
          taxable ? 'bg-teal-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform duration-200 ${
            taxable ? 'translate-x-3' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}

function RemoveItemButton({ item, onRemoveItem }: { item: Item; onRemoveItem: (id: string) => void }) {
  return (
    <button
      onClick={() => onRemoveItem(item.id)}
      aria-label={`Remove "${item.name || 'item'}"`}
      className="text-gray-300 hover:text-red-400 focus:outline-none focus:text-red-400 transition-colors p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
    >
      <span aria-hidden="true">×</span>
    </button>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────


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

function GripIcon() {
  return (
    <svg viewBox="0 0 8 12" fill="currentColor" className="w-2 h-3" aria-hidden="true">
      <circle cx="2" cy="2" r="1.2" />
      <circle cx="6" cy="2" r="1.2" />
      <circle cx="2" cy="6" r="1.2" />
      <circle cx="6" cy="6" r="1.2" />
      <circle cx="2" cy="10" r="1.2" />
      <circle cx="6" cy="10" r="1.2" />
    </svg>
  )
}
