import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { BillState } from '../types'
import { DEFAULT_STATE } from './useBillSplit'
import { useIncomingLink } from './useIncomingLink'
import { billLinkUrl, personLinkUrl } from '../share/link/billLink'

const bill: BillState = {
  ...DEFAULT_STATE,
  name: 'Friday dinner',
  participants: [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }],
  items: [{ id: 'i', name: 'Pizza', price: '20', assignedTo: null }],
}

function visit(hash: string) {
  window.history.replaceState(null, '', `/${hash}`)
}

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('useIncomingLink with a link to one person', () => {
  const hash = new URL(personLinkUrl(bill, 'b', 'https://x.test/')).hash

  it('opens a blank bill straight away and focuses that person', async () => {
    visit(hash)
    const load = vi.fn()
    const { result } = renderHook(() => useIncomingLink(DEFAULT_STATE, load))

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    const opened = load.mock.calls[0][0] as BillState
    expect(opened.participants.find(p => p.id === result.current.focus?.participantId)?.name).toBe('Bob')
    expect(window.location.hash).toBe('')

    act(() => result.current.clearFocus())
    expect(result.current.focus).toBeNull()
  })

  it('focuses that person only once the shared bill is opened over a bill in progress', async () => {
    visit(hash)
    const load = vi.fn()
    const { result } = renderHook(() => useIncomingLink(bill, load))

    await waitFor(() => expect(result.current.incoming?.kind).toBe('bill'))
    expect(result.current.focus).toBeNull()
    act(() => result.current.open())
    expect(load).toHaveBeenCalledTimes(1)
    expect(result.current.focus).not.toBeNull()
  })

  it('focuses no one when the shared bill is dismissed', async () => {
    visit(hash)
    const { result } = renderHook(() => useIncomingLink(bill, vi.fn()))

    await waitFor(() => expect(result.current.incoming?.kind).toBe('bill'))
    act(() => result.current.dismiss())
    expect(result.current.focus).toBeNull()
  })
})

describe('useIncomingLink with a link to the bill as a whole', () => {
  const hash = new URL(billLinkUrl(bill, 'https://x.test/')).hash

  it('opens a blank bill and focuses the bill total, not a person', async () => {
    visit(hash)
    const load = vi.fn()
    const { result } = renderHook(() => useIncomingLink(DEFAULT_STATE, load))

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    expect(result.current.focus).toEqual({ participantId: null, seq: 1 })

    act(() => result.current.clearFocus())
    expect(result.current.focus).toBeNull()
  })

  it('focuses the bill total only once the shared bill is opened over a bill in progress', async () => {
    visit(hash)
    const load = vi.fn()
    const { result } = renderHook(() => useIncomingLink(bill, load))

    await waitFor(() => expect(result.current.incoming?.kind).toBe('bill'))
    expect(result.current.focus).toBeNull()
    act(() => result.current.open())
    expect(result.current.focus).toMatchObject({ participantId: null })
  })

  it('does not scroll anywhere when the shared bill is dismissed', async () => {
    visit(hash)
    const { result } = renderHook(() => useIncomingLink(bill, vi.fn()))

    await waitFor(() => expect(result.current.incoming?.kind).toBe('bill'))
    act(() => result.current.dismiss())
    expect(result.current.focus).toBeNull()
  })

  it('does not focus anything when no link is opened', async () => {
    const { result } = renderHook(() => useIncomingLink(DEFAULT_STATE, vi.fn()))
    await act(async () => {})
    expect(result.current.focus).toBeNull()
  })

  it('lets a link to a person win over the bill total', async () => {
    visit(new URL(personLinkUrl(bill, 'a', 'https://x.test/')).hash)
    const { result } = renderHook(() => useIncomingLink(DEFAULT_STATE, vi.fn()))
    await waitFor(() => expect(result.current.focus).not.toBeNull())
    expect(result.current.focus?.participantId).not.toBeNull()
  })
})
