import { useEffect, useState } from 'react'

export type LinkModule = typeof import('../share/link/billLink')

/**
 * Loads the bill link encoder in the background and returns it once it has
 * arrived, or null until then. A share icon that builds a link needs it
 * during the tap itself (see ShareButton), so it stays disabled while this
 * is null. If the chunk can't be fetched this stays null for good; the bill
 * share buttons at the bottom already say to reload.
 */
export function useLinkEncoder(): LinkModule | null {
  const [link, setLink] = useState<LinkModule | null>(null)
  useEffect(() => {
    let active = true
    import('../share/link/billLink').then(mod => { if (active) setLink(mod) }, () => {})
    return () => { active = false }
  }, [])
  return link
}
