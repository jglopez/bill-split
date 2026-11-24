import { useState, useEffect } from 'react'

/** The Tailwind `sm` breakpoint. Viewports narrower than this are "mobile". */
export const SM_BREAKPOINT_PX = 640

function isNarrow(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < SM_BREAKPOINT_PX
}

/**
 * Returns true when the viewport width is below the Tailwind `sm` breakpoint.
 * Updates reactively on window resize, which includes rotating a phone.
 *
 * The first render already reflects the current width, so a phone never
 * flashes the wide layout before switching to the narrow one.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(isNarrow)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => setIsMobile(isNarrow())
    handler()
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}
