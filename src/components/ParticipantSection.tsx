import { useRef, useState } from 'react'
import type { Participant } from '../types'

interface Props {
  participants: Participant[]
  onAdd: (name: string) => void
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
}

/**
 * Participant management is intentionally isolated in this component so the
 * source of participant data (freeform text today, user profile tomorrow) can
 * be swapped without touching the rest of the app.
 */
export function ParticipantSection({ participants, onAdd, onRemove, onRename }: Props) {
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

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Participants
      </h2>

      <div className="flex flex-wrap gap-2 items-center">
        {participants.map(p => (
          <ParticipantChip
            key={p.id}
            participant={p}
            onRemove={onRemove}
            onRename={onRename}
          />
        ))}

        {/* New participant input */}
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
            className="border border-gray-300 rounded-full px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent min-w-[140px]"
          />
          <button
            onClick={handleAdd}
            aria-label="Add participant"
            className="h-8 w-8 flex items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 transition-colors"
          >
            <span aria-hidden="true" className="text-lg leading-none">+</span>
          </button>
        </div>
      </div>

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
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(participant.name)
  const [error, setError] = useState('')

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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') {
      setDraft(participant.name)
      setError('')
      setEditing(false)
    }
  }

  return (
    <div className="relative">
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={e => {
              setDraft(e.target.value)
              if (error) setError('')
            }}
            onKeyDown={handleKeyDown}
            onBlur={commit}
            aria-label={`Rename ${participant.name}`}
            className="border border-teal-400 rounded-full px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[100px]"
          />
          {error && (
            <span role="alert" className="text-xs text-red-600 absolute -bottom-5 left-0 whitespace-nowrap">
              {error}
            </span>
          )}
        </div>
      ) : (
        <span className="inline-flex items-center gap-1 bg-teal-50 border border-teal-200 text-teal-800 rounded-full pl-3 pr-1 py-1 text-sm">
          <button
            onClick={() => {
              setDraft(participant.name)
              setEditing(true)
            }}
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
