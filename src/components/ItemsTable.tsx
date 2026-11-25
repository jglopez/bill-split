import { useRef, useState } from 'react'
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
import { isItemBlank } from '../utils/items'
import { describeGroup, summarizeGroup } from '../utils/group'
import GripIcon from './icons/grip.svg?react'
import CheckIcon from './icons/check.svg?react'
import ChevronIcon from './icons/chevron.svg?react'
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
 * and remove on top, then one line summarizing who shares the item. Tapping
 * that line opens the participant list for that card (see ItemAssignment).
 * The cards keep row dragging by the grip. With no columns to drag there,
 * ParticipantSection's one-per-line list reorders participants instead.
 */
export function ItemsTable({ participants, items, onUpdateItem, onRemoveItem, onReorderItems, onReorderColumns }: Props) {
  const allIds = participants.map(p => p.id)
  const isMobile = useIsMobile()

  const [activeColumnId, setActiveColumnId] = useState<string | null>(null)
  // Narrow layout only: the one card whose participant list is open.
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  // Price fields by item, so Enter in a card's name can move on to its price.
  const priceInputs = useRef(new Map<string, HTMLInputElement>())

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
    // Items can outlive everyone (see Clear participants), so say they are
    // still there rather than looking like an empty bill.
    const kept = items.filter(i => !isItemBlank(i)).length
    return (
      <p className="text-sm text-gray-400 italic mb-6">
        {kept === 0
          ? 'Add participants above to start entering items.'
          : `${kept} ${kept === 1 ? 'item is' : 'items are'} kept. Add participants above to split ${kept === 1 ? 'it' : 'them'}.`}
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
        {/* Each layout keys its own DndContext. DndContext uses its props as
            effect dependencies, so React must not reuse one instance across
            layouts that pass it a different set of props. */}
        <DndContext key="cards" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <ul aria-label="Items" className="space-y-2">
              {items.map(item => {
                const blank = isLastRow(item)
                return (
                  <SortableItemCard key={item.id} id={item.id} isBlank={blank}>
                    <div className="flex items-center gap-1">
                      {/* The price sits on the last line of a wrapped name. */}
                      <div className="flex flex-1 min-w-0 items-end gap-1">
                        <div className="flex-1 min-w-0">
                          <ItemNameInput
                            item={item}
                            isBlank={blank}
                            onUpdateItem={onUpdateItem}
                            wrap
                            onEnter={() => priceInputs.current.get(item.id)?.focus()}
                          />
                        </div>
                        <ItemPriceInput
                          item={item}
                          onUpdateItem={onUpdateItem}
                          className="w-20"
                          inputRef={el => {
                            if (el) priceInputs.current.set(item.id, el)
                            else priceInputs.current.delete(item.id)
                          }}
                        />
                      </div>
                      {blank
                        ? <span aria-hidden="true" className="w-11 flex-shrink-0" /> // keeps prices aligned with item cards
                        : <RemoveItemButton item={item} onRemoveItem={onRemoveItem} />}
                    </div>
                    {!blank && (
                      <ItemAssignment
                        item={item}
                        participants={participants}
                        open={openItemId === item.id}
                        onToggleOpen={() => setOpenItemId(openItemId === item.id ? null : item.id)}
                        isAssignedToAll={isAssignedToAll(item)}
                        onToggleAll={() => toggleAllAssigned(item)}
                        onToggleParticipant={id => toggleParticipant(item, id)}
                        onUpdateItem={onUpdateItem}
                      />
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
      <DndContext key="table" sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                                {assigned && <CheckIcon className="w-3 h-3" aria-hidden="true" />}
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
                            {isAssignedToAll(item) && <CheckIcon className="w-3 h-3" aria-hidden="true" />}
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
              {assigned && <CheckIcon className="w-3 h-3" aria-hidden="true" />}
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
            <GripIcon className="w-2 h-3" aria-hidden="true" />
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
            <GripIcon className="w-2 h-3" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </li>
  )
}

/**
 * Who shares an item, for the narrow layout. Closed, it is one tappable line
 * summarizing the split. Open, it lists one participant per line (checkbox,
 * name, share), then "Everyone" and the taxable switch. Only one card is open
 * at a time, so a long bill stays short.
 */
function ItemAssignment({
  item,
  participants,
  open,
  onToggleOpen,
  isAssignedToAll,
  onToggleAll,
  onToggleParticipant,
  onUpdateItem,
}: {
  item: Item
  participants: Participant[]
  open: boolean
  onToggleOpen: () => void
  isAssignedToAll: boolean
  onToggleAll: () => void
  onToggleParticipant: (participantId: string) => void
  onUpdateItem: (item: Item) => void
}) {
  const panelId = `assign-${item.id}`
  const assigned = participants.filter(p => isParticipantAssigned(item, p.id))
  const share = assigned.length > 0 ? getItemShare(item, assigned[0].id, participants.length) : 0

  // Name whichever side is shorter, so a mostly-shared item doesn't list
  // nearly everyone and run out of room.
  const who = describeGroup(summarizeGroup(participants, p => isParticipantAssigned(item, p.id)), true) || 'No one'

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Split of "${item.name || 'item'}": ${who}${share > 0 ? `, ${formatAmount(share)}${assigned.length > 1 ? ' each' : ''}` : ''}${item.taxable === false ? ', no tax' : ''}`}
        onClick={onToggleOpen}
        className="flex w-full min-h-11 items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
      >
        <span className={`flex-1 min-w-0 truncate ${assigned.length === 0 ? 'text-amber-600' : 'text-gray-600'}`}>
          {who}
        </span>
        {share > 0 && (
          <span className="flex-shrink-0 text-xs tabular-nums text-gray-500">
            {formatAmount(share)}{assigned.length > 1 ? ' each' : ''}
          </span>
        )}
        {item.taxable === false && <span className="flex-shrink-0 text-xs text-gray-400">no tax</span>}
        <ChevronIcon
          className={`w-3 h-2 flex-shrink-0 mr-2 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div id={panelId} className="border-t border-gray-100 pr-2">
          {participants.map(p => (
            <AssignRow
              key={p.id}
              label={p.name}
              checked={isParticipantAssigned(item, p.id)}
              share={getItemShare(item, p.id, participants.length)}
              onChange={() => onToggleParticipant(p.id)}
              ariaLabel={`Assign "${item.name || 'item'}" to ${p.name}`}
            />
          ))}
          <div className="flex items-center justify-between border-t border-gray-100">
            <AssignRow
              label="Everyone"
              checked={isAssignedToAll}
              onChange={onToggleAll}
              ariaLabel={`Assign "${item.name || 'item'}" to all participants`}
            />
            <TaxableSwitch item={item} onUpdateItem={onUpdateItem} showLabel />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * One participant (or "Everyone") line in an open card. The real checkbox is
 * visually hidden and the whole line is its label, so the line is the touch
 * target. The share keeps a fixed-width slot whether or not the person is
 * checked, so toggling someone never moves anything.
 */
function AssignRow({
  label,
  checked,
  share,
  onChange,
  ariaLabel,
}: {
  label: string
  checked: boolean
  /** Omitted for the "Everyone" line, which has no share. */
  share?: number
  onChange: () => void
  ariaLabel: string
}) {
  return (
    <label className="flex flex-1 min-h-11 min-w-0 items-center gap-3 cursor-pointer select-none rounded has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-500">
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={ariaLabel} className="sr-only" />
      <span
        aria-hidden="true"
        className={`w-5 h-5 flex-shrink-0 rounded flex items-center justify-center border transition-colors ${
          checked ? 'bg-teal-600 border-teal-600 text-white' : 'border-gray-300 bg-white'
        }`}
      >
        {checked && <CheckIcon className="w-3 h-3" aria-hidden="true" />}
      </span>
      <span className={`flex-1 min-w-0 truncate ${checked ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
      {share !== undefined && (
        <span className="w-16 flex-shrink-0 text-right tabular-nums text-gray-600">
          {share > 0 ? formatAmount(share) : <span className="text-gray-300">—</span>}
        </span>
      )}
    </label>
  )
}

// ─── Inputs shared by both layouts ────────────────────────────────────────────

/**
 * The item's description. On phones the field is narrow, and iOS Safari can't
 * swipe-scroll a one-line field, so the end of a long name was out of reach
 * once the field lost focus. The card layout passes `wrap` to use a textarea
 * that grows a line at a time instead, so the whole name is always visible.
 * It stays a single-line value: Enter never adds a line (the card uses it to
 * move on to the price) and pasted line breaks become spaces.
 */
function ItemNameInput({
  item,
  isBlank,
  onUpdateItem,
  wrap = false,
  onEnter,
}: {
  item: Item
  isBlank: boolean
  onUpdateItem: (item: Item) => void
  wrap?: boolean
  /** Called on Enter in the wrapping field, which never inserts a line break. */
  onEnter?: () => void
}) {
  const fieldClass =
    'w-full bg-transparent border-0 border-b border-dashed border-gray-300 focus:border-gray-500 focus:outline-none py-0.5 placeholder-gray-300 text-gray-800'

  if (!wrap) {
    return (
      <input
        type="text"
        value={item.name}
        onChange={e => onUpdateItem({ ...item, name: e.target.value })}
        placeholder={isBlank ? 'Description' : ''}
        aria-label="Item description"
        maxLength={NAME_MAX_LENGTH}
        className={fieldClass}
      />
    )
  }

  // The textarea and an invisible copy of its text share one grid cell, so the
  // copy sets the height and the textarea fills it. No measuring in script.
  // Both copies set the same font size and line height, or the heights drift.
  // This layout is phone-only, so it matches the size index.css gives phone text fields.
  const wrapClass = 'col-start-1 row-start-1 text-base whitespace-pre-wrap [overflow-wrap:anywhere]'
  return (
    <div className="grid">
      <textarea
        rows={1}
        value={item.name}
        onChange={e => onUpdateItem({ ...item, name: e.target.value.replace(/[\r\n]+/g, ' ') })}
        onKeyDown={e => {
          // Enter that confirms an IME composition (keyCode 229 in Safari)
          // belongs to the input method, not to us.
          if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
            e.preventDefault()
            onEnter?.()
          }
        }}
        enterKeyHint={onEnter ? 'next' : undefined}
        placeholder={isBlank ? 'Description' : ''}
        aria-label="Item description"
        maxLength={NAME_MAX_LENGTH}
        className={`${fieldClass} ${wrapClass} resize-none overflow-hidden`}
      />
      {/* The trailing space keeps a new empty line's height while typing. */}
      <span aria-hidden="true" className={`${fieldClass} ${wrapClass} invisible`}>
        {item.name}{' '}
      </span>
    </div>
  )
}

function ItemPriceInput({
  item,
  onUpdateItem,
  className,
  inputRef,
}: {
  item: Item
  onUpdateItem: (item: Item) => void
  /** Width of the field; the layouts size it differently. */
  className: string
  inputRef?: React.Ref<HTMLInputElement>
}) {
  const priceInvalid = item.price !== '' && !isValidPrice(item.price)
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        ref={inputRef}
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
