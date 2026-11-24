import { useRef, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Participant } from '../types'
import { NAME_MAX_LENGTH } from '../constants'
import { GripIcon } from './GripIcon'
import { useIsMobile } from '../hooks/useIsMobile'

interface Props {
  participants: Participant[]
  onAdd: (name: string) => void
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
  /** Moves a participant. Used by the narrow layout, which has no table columns to drag. */
  onReorder: (fromIndex: number, toIndex: number) => void
}

/**
 * Participant management is isolated so the data source can change without
 * touching the rest of the app.
 *
 * Wide screens show wrapping chips; reordering happens by dragging the items
 * table's column headers. Narrow screens show one participant per line with
 * a drag grip, since the items table becomes cards there and has no columns.
 */
export function ParticipantSection({ participants, onAdd, onRemove, onRename, onReorder }: Props) {
  const isMobile = useIsMobile()
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleAdd() {
    const trimmed = newName.trim()
    if (!trimmed) {
      setError('Name is required.')
      inputRef.current?.focus()
      return
    }
    setError('')
    onAdd(trimmed)
    setNewName('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd()
  }

  const addInput = (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="text"
        value={newName}
        onChange={e => {
          setNewName(e.target.value)
          if (error) setError('')
        }}
        onKeyDown={handleKeyDown}
        placeholder="Add participant"
        aria-label="New participant name"
        maxLength={NAME_MAX_LENGTH}
        className={`border border-gray-300 rounded-full px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent min-w-[140px] ${isMobile ? 'flex-1' : ''}`}
      />
      <button
        onClick={handleAdd}
        aria-label="Add participant"
        className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 transition-colors"
      >
        <span aria-hidden="true" className="text-lg leading-none">+</span>
      </button>
    </div>
  )

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Participants
      </h2>

      {isMobile ? (
        <>
          {participants.length > 0 && (
            <ParticipantList participants={participants} onRemove={onRemove} onRename={onRename} onReorder={onReorder} />
          )}
          <div className="mt-2">{addInput}</div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          {participants.map(p => (
            <ParticipantChip
              key={p.id}
              participant={p}
              onRemove={onRemove}
              onRename={onRename}
            />
          ))}
          {addInput}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

interface ChipProps {
  participant: Participant
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
}

function ParticipantChip({ participant, onRemove, onRename }: ChipProps) {
  const rename = useRename(participant, onRename)

  return (
    <div className="relative">
      {rename.editing ? (
        <div className="flex items-center gap-1">
          <RenameInput participant={participant} rename={rename} className="rounded-full min-w-[100px]" />
          {rename.error && (
            <span role="alert" className="text-xs text-red-600 absolute -bottom-5 left-0 whitespace-nowrap">
              {rename.error}
            </span>
          )}
        </div>
      ) : (
        <span className="inline-flex items-center gap-1 bg-teal-50 border border-teal-200 text-teal-800 rounded-full pl-3 pr-1 py-1 text-sm">
          <button
            onClick={rename.start}
            aria-label={`Rename ${participant.name}`}
            className="hover:underline focus:outline-none focus:underline"
          >
            {participant.name}
          </button>
          <button
            onClick={() => onRemove(participant.id)}
            aria-label={`Remove ${participant.name}`}
            className="h-5 w-5 flex items-center justify-center rounded-full text-teal-500 hover:bg-teal-200 hover:text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-colors"
          >
            <span aria-hidden="true">×</span>
          </button>
        </span>
      )}
    </div>
  )
}

// ─── Rename (shared by both layouts) ──────────────────────────────────────────

function useRename(participant: Participant, onRename: (id: string, name: string) => void) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(participant.name)
  const [error, setError] = useState('')

  function start() {
    setDraft(participant.name)
    setEditing(true)
  }

  function commit() {
    const trimmed = draft.trim()
    if (!trimmed) {
      setError('Name cannot be empty.')
      return
    }
    setError('')
    onRename(participant.id, trimmed)
    setEditing(false)
  }

  function cancel() {
    setDraft(participant.name)
    setError('')
    setEditing(false)
  }

  function change(value: string) {
    setDraft(value)
    if (error) setError('')
  }

  return { editing, draft, error, start, commit, cancel, change }
}

type Rename = ReturnType<typeof useRename>

function RenameInput({ participant, rename, className }: { participant: Participant; rename: Rename; className: string }) {
  return (
    <input
      autoFocus
      type="text"
      value={rename.draft}
      onChange={e => rename.change(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') rename.commit()
        if (e.key === 'Escape') rename.cancel()
      }}
      onBlur={rename.commit}
      aria-label={`Rename ${participant.name}`}
      maxLength={NAME_MAX_LENGTH}
      className={`border border-teal-400 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${className}`}
    />
  )
}

// ─── One-per-line list (narrow screens) ───────────────────────────────────────

function ParticipantList({
  participants,
  onRemove,
  onRename,
  onReorder,
}: {
  participants: Participant[]
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
}) {
  const ids = participants.map(p => p.id)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(active.id as string)
    const to = ids.indexOf(over.id as string)
    if (from !== -1 && to !== -1) onReorder(from, to)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul aria-label="Participants" className="divide-y divide-gray-100 border-y border-gray-100">
          {participants.map(p => (
            <ParticipantRow key={p.id} participant={p} onRemove={onRemove} onRename={onRename} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function ParticipantRow({ participant, onRemove, onRename }: ChipProps) {
  const rename = useRename(participant, onRename)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: participant.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  }

  return (
    <li ref={setNodeRef} style={style} className="flex min-h-11 items-center gap-1 bg-white text-sm">
      <button
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none focus:outline-none min-h-11 w-8 flex-shrink-0 flex items-center justify-center"
        aria-label={`Drag to reorder ${participant.name}`}
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
      {rename.editing ? (
        <div className="flex-1 min-w-0">
          <RenameInput participant={participant} rename={rename} className="w-full rounded" />
          {rename.error && (
            <p role="alert" className="text-xs text-red-600">
              {rename.error}
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={rename.start}
          aria-label={`Rename ${participant.name}`}
          className="flex-1 min-w-0 min-h-11 truncate text-left text-gray-800 focus:outline-none focus-visible:underline"
        >
          {participant.name}
        </button>
      )}
      <button
        onClick={() => onRemove(participant.id)}
        aria-label={`Remove ${participant.name}`}
        className="min-h-11 min-w-11 flex-shrink-0 flex items-center justify-center text-gray-300 hover:text-red-400 focus:outline-none focus:text-red-400 transition-colors"
      >
        <span aria-hidden="true">×</span>
      </button>
    </li>
  )
}
