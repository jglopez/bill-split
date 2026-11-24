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
 */
export function useIncomingLink(state: BillState, load: (bill: BillState) => void) {
  const [incoming, setIncoming] = useState<IncomingLink | null>(null)
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
  }, [load])

  const open = useCallback(() => {
    if (incoming?.kind === 'bill') load(incoming.bill)
    clearIncomingLink()
    setIncoming(null)
  }, [incoming, load])

  const dismiss = useCallback(() => {
    clearIncomingLink()
    setIncoming(null)
  }, [])

  return { incoming, open, dismiss }
}
