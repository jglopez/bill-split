import { useState, useEffect } from 'react'
import type { Participant } from '../types'
import { readJSON, writeJSON } from '../lib/versionedStore'

const COLUMN_ORDER_KEY = 'bill-split-column-order:v1'

/**
 * Reconciles a stored column order against the current participant ids:
 * deduplicates (so corrupt/duplicate localStorage data can't produce
 * duplicate columns), drops ids of removed participants, and appends new
 * participants at the end. Non-array input falls back to insertion order.
 */
export function reconcileColumnOrder(stored: unknown, participantIds: string[]): string[] {
  if (!Array.isArray(stored)) return [...participantIds]
  const ids = [...new Set(stored as string[])]
  const filtered = ids.filter(id => participantIds.includes(id))
  const added = participantIds.filter(id => !ids.includes(id))
  return [...filtered, ...added]
}

/**
 * Manages participant column display order, persisted to localStorage.
 *
 * Defaults to insertion order. New participants are appended; removed
 * participants are dropped. The stored order survives page refreshes.
 */
export function useColumnOrder(participants: Participant[]): {
  columnOrder: string[]
  setColumnOrder: React.Dispatch<React.SetStateAction<string[]>>
  orderedParticipants: Participant[]
} {
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    reconcileColumnOrder(readJSON(COLUMN_ORDER_KEY), participants.map(p => p.id))
  )

  // Sync when participants are added or removed
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColumnOrder(prev => {
      const next = reconcileColumnOrder(prev, participants.map(p => p.id))
      // Keep the previous array when nothing changed so consumers don't re-render.
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev
      return next
    })
  }, [participants])

  // Persist to localStorage
  useEffect(() => {
    writeJSON(COLUMN_ORDER_KEY, columnOrder)
  }, [columnOrder])

  const participantMap = new Map(participants.map(p => [p.id, p]))
  const orderedParticipants = columnOrder
    .map(id => participantMap.get(id))
    .filter((p): p is Participant => p !== undefined)

  return { columnOrder, setColumnOrder, orderedParticipants }
}
