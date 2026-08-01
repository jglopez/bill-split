// Hook tests for useIsMobile.
// Run with: npm test

import { useIsMobile } from './useIsMobile'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const DEFAULT_WIDTH = window.innerWidth

function setInnerWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
  window.dispatchEvent(new Event('resize'))
}

afterEach(() => {
  setInnerWidth(DEFAULT_WIDTH)
})

describe('useIsMobile', () => {
  it('defaults to false above the 640px breakpoint (jsdom default width)', () => {
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('flips true when the viewport narrows below 640px', () => {
    const { result } = renderHook(() => useIsMobile())
    act(() => {
      setInnerWidth(500)
    })
    expect(result.current).toBe(true)
  })

  it('flips back to false when the viewport widens back above 640px', () => {
    const { result } = renderHook(() => useIsMobile())
    act(() => {
      setInnerWidth(500)
    })
    expect(result.current).toBe(true)
    act(() => {
      setInnerWidth(800)
    })
    expect(result.current).toBe(false)
  })

  it('removes the resize listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useIsMobile())
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    removeSpy.mockRestore()
  })
})
