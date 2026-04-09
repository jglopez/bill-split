import { useState, useEffect } from 'react'
import type { Participant } from '../types'

const COLUMN_ORDER_KEY = 'bill-split-column-order:v1'

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
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const allIds = participants.map(p => p.id)
    try {
      const stored = localStorage.getItem(COLUMN_ORDER_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as unknown
        if (Array.isArray(parsed)) {
          const ids = parsed as string[]
          const filtered = ids.filter(id => allIds.includes(id))
          const added = allIds.filter(id => !ids.includes(id))
          return [...filtered, ...added]
        }
      }
    } catch {}
    return [...allIds]
  })

  // Sync when participants are added or removed
  useEffect(() => {
    setColumnOrder(prev => {
      const participantIds = participants.map(p => p.id)
      const filtered = prev.filter(id => participantIds.includes(id))
      const added = participantIds.filter(id => !prev.includes(id))
      if (filtered.length === prev.length && added.length === 0) return prev
      return [...filtered, ...added]
    })
  }, [participants])

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(columnOrder))
    } catch {}
  }, [columnOrder])

  const orderedParticipants = columnOrder
    .map(id => participants.find(p => p.id === id))
    .filter((p): p is Participant => p !== undefined)

  return { columnOrder, setColumnOrder, orderedParticipants }
}
