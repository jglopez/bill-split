import { useState, useEffect } from 'react'

/**
 * Returns true when the viewport width is below the Tailwind `sm` breakpoint
 * (640px). Updates reactively on window resize.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => setIsMobile(window.innerWidth < 640)
    handler()
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}
