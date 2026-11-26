import { useCallback, useEffect, useRef, useState } from 'react'
import type { BillState } from '../types'
import { isBillBlank } from './useBillSplit'
import { clearIncomingLink, readIncomingLink, type IncomingLink } from '../share/link/incoming'

/**
 * Handles a bill link in the address bar, on launch and whenever the
 * fragment changes while the app is open.
 *
 * If the current bill is blank, a shared bill opens straight away, since
 * nothing would be lost. Otherwise it waits in `incoming` until the person
 * chooses to `open` it or `dismiss` it, so a link never silently replaces
 * the bill in progress. Links that can't be opened also wait in `incoming`,
 * so the app can say why.
 *
 * Once a shared bill is opened, `focus` says where the summary should scroll
 * until `clearFocus` is called. A link can point at one person's receipt,
 * and then `participantId` names them. A link that points at no one (or at
 * someone the bill doesn't have) gives a null `participantId`, which means
 * the bill total: that is where anyone opening a shared bill should land,
 * so no separate marker is needed in the link. `seq` changes each time, so
 * opening the same link twice scrolls twice. Dismissing the link doesn't
 * scroll anywhere, and a bill that was never opened from a link has no
 * `focus`.
 */
export function useIncomingLink(state: BillState, load: (bill: BillState) => void) {
  const [incoming, setIncoming] = useState<IncomingLink | null>(null)
  const [focus, setFocus] = useState<{ participantId: string | null; seq: number } | null>(null)
  const focusOn = useCallback((participantId: string | null) => {
    setFocus(prev => ({ participantId, seq: (prev?.seq ?? 0) + 1 }))
  }, [])
  const clearFocus = useCallback(() => setFocus(null), [])
  // The bill as of the latest render, read when a link finishes decoding.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    let active = true

    function check() {
      void readIncomingLink(window.location.hash).then(link => {
        if (!active || !link) return
        if (link.kind === 'bill' && isBillBlank(stateRef.current)) {
          load(link.bill)
          focusOn(link.personId)
          clearIncomingLink()
          setIncoming(null)
          return
        }
        setIncoming(link)
      })
    }

    check()
    window.addEventListener('hashchange', check)
    return () => {
      active = false
      window.removeEventListener('hashchange', check)
    }
  }, [load, focusOn])

  const open = useCallback(() => {
    if (incoming?.kind === 'bill') {
      load(incoming.bill)
      focusOn(incoming.personId)
    }
    clearIncomingLink()
    setIncoming(null)
  }, [incoming, load, focusOn])

  const dismiss = useCallback(() => {
    clearIncomingLink()
    setIncoming(null)
  }, [])

  return { incoming, open, dismiss, focus, clearFocus }
}
