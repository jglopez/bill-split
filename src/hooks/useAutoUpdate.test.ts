import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAutoUpdate, RELOAD_TARGET_KEY } from './useAutoUpdate'

const BASE = import.meta.env.BASE_URL
const VERSION_URL = `${BASE}version.json`

function mockDeployed(build: string | Error) {
  return vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === VERSION_URL) {
      if (build instanceof Error) throw build
      return new Response(JSON.stringify({ version: 'v9.9.9', build }), { status: 200 })
    }
    return new Response('<html></html>', { status: 200 })
  })
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}

/** Let pending fetch promises settle. */
const flush = () => new Promise((r) => setTimeout(r, 0))

let reload: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubEnv('PROD', true)
  sessionStorage.clear()
  setVisibility('visible')
  reload = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('useAutoUpdate', () => {
  it('does nothing when the deployed build matches the running build', async () => {
    const fetchMock = mockDeployed(__BUILD_ID__)
    vi.stubGlobal('fetch', fetchMock)
    renderHook(() => useAutoUpdate({ enabled: true }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(VERSION_URL, { cache: 'no-store' }))
    await flush()
    expect(reload).not.toHaveBeenCalled()
  })

  it('refreshes the cached page then reloads when a newer build is deployed', async () => {
    const fetchMock = mockDeployed('newbuild')
    vi.stubGlobal('fetch', fetchMock)
    renderHook(() => useAutoUpdate({ enabled: true }))

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith(BASE, { cache: 'reload' })
    expect(sessionStorage.getItem(RELOAD_TARGET_KEY)).toBe('newbuild')
  })

  it('checks again when the app returns to the foreground', async () => {
    const fetchMock = mockDeployed(__BUILD_ID__)
    vi.stubGlobal('fetch', fetchMock)
    renderHook(() => useAutoUpdate({ enabled: true }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await flush()

    // A new build goes live while the app is in the background.
    fetchMock.mockImplementation(mockDeployed('newbuild'))
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(reload).not.toHaveBeenCalled()

    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
  })

  it('checks again when the page is restored from the back-forward cache', async () => {
    const fetchMock = mockDeployed(__BUILD_ID__)
    vi.stubGlobal('fetch', fetchMock)
    renderHook(() => useAutoUpdate({ enabled: true }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await flush()

    fetchMock.mockImplementation(mockDeployed('newbuild'))
    const event = new Event('pageshow') as PageTransitionEvent
    Object.defineProperty(event, 'persisted', { value: true })
    window.dispatchEvent(event)
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
  })

  it('does not reload while disabled (state is not being saved)', async () => {
    const fetchMock = mockDeployed('newbuild')
    vi.stubGlobal('fetch', fetchMock)
    renderHook(() => useAutoUpdate({ enabled: false }))
    await flush()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not reload again toward a build it already tried this session', async () => {
    sessionStorage.setItem(RELOAD_TARGET_KEY, 'newbuild')
    const fetchMock = mockDeployed('newbuild')
    vi.stubGlobal('fetch', fetchMock)
    renderHook(() => useAutoUpdate({ enabled: true }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await flush()
    expect(reload).not.toHaveBeenCalled()
  })

  it('ignores network failures', async () => {
    const fetchMock = mockDeployed(new TypeError('offline'))
    vi.stubGlobal('fetch', fetchMock)
    renderHook(() => useAutoUpdate({ enabled: true }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await flush()
    expect(reload).not.toHaveBeenCalled()
  })

  it('never checks outside production builds', async () => {
    vi.stubEnv('PROD', false)
    const fetchMock = mockDeployed('newbuild')
    vi.stubGlobal('fetch', fetchMock)
    renderHook(() => useAutoUpdate({ enabled: true }))
    await flush()

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
