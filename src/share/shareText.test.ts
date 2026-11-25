import { afterEach, describe, expect, it, vi } from 'vitest'
import { canUseShareSheet, copyText, shareText } from './shareText'

// jsdom has neither navigator.share nor navigator.clipboard, so each test
// installs the browser features it needs and removes them afterward.
const installed: string[] = []

function install(name: 'share' | 'canShare' | 'clipboard', value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true, writable: true })
  installed.push(name)
}

afterEach(() => {
  for (const name of installed.splice(0)) {
    delete (navigator as unknown as Record<string, unknown>)[name]
  }
})

function installClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)
  install('clipboard', { writeText })
  return writeText
}

describe('canUseShareSheet', () => {
  it('is false without navigator.share', () => {
    expect(canUseShareSheet()).toBe(false)
  })

  it('is true with navigator.share and no canShare', () => {
    install('share', vi.fn())
    expect(canUseShareSheet()).toBe(true)
  })

  it('follows canShare when the browser has it', () => {
    install('share', vi.fn())
    install('canShare', () => false)
    expect(canUseShareSheet()).toBe(false)
  })
})

describe('shareText', () => {
  it('opens the share sheet with the text, title and url', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    install('share', share)
    const writeText = installClipboard()

    await expect(shareText('hello', { title: 'Dinner', url: 'https://example.com/b' })).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({ text: 'hello', title: 'Dinner', url: 'https://example.com/b' })
    expect(writeText).not.toHaveBeenCalled()
  })

  it('leaves out empty title and url', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    install('share', share)
    await shareText('hello', { title: '' })
    expect(share).toHaveBeenCalledWith({ text: 'hello' })
  })

  it('shares only the url when the text is empty', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    install('share', share)
    await shareText('', { title: 'Dinner', url: 'https://example.com/b' })
    expect(share).toHaveBeenCalledWith({ title: 'Dinner', url: 'https://example.com/b' })
  })

  it('copies only the url when the text is empty and there is no share sheet', async () => {
    const writeText = installClipboard()
    await expect(shareText('', { url: 'https://example.com/b' })).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith('https://example.com/b')
  })

  it('reports cancelled when the user closes the share sheet, without copying', async () => {
    install('share', vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError')))
    const writeText = installClipboard()

    await expect(shareText('hello')).resolves.toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('reports cancelled, without copying, when a share sheet is already open', async () => {
    install('share', vi.fn().mockRejectedValue(new DOMException('busy', 'InvalidStateError')))
    const writeText = installClipboard()

    await expect(shareText('hello')).resolves.toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('falls back to the clipboard when the share sheet fails for another reason', async () => {
    install('share', vi.fn().mockRejectedValue(new DOMException('no gesture', 'NotAllowedError')))
    const writeText = installClipboard()

    await expect(shareText('hello')).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('copies to the clipboard when there is no share sheet, with the url appended', async () => {
    const writeText = installClipboard()

    await expect(shareText('hello', { url: 'https://example.com/b' })).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith('hello\n\nhttps://example.com/b')
  })

  it('reports failed when the clipboard refuses', async () => {
    install('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    await expect(shareText('hello')).resolves.toBe('failed')
  })

  it('reports failed when there is neither a share sheet nor a clipboard', async () => {
    await expect(shareText('hello')).resolves.toBe('failed')
  })
})

describe('copyText with rich text', () => {
  // jsdom has no ClipboardItem; a minimal stand-in records what it was given.
  class FakeClipboardItem {
    constructor(readonly items: Record<string, Blob>) {}
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function written(write: ReturnType<typeof vi.fn>) {
    const [[[item]]] = write.mock.calls as [[[FakeClipboardItem]]]
    return {
      plain: await item.items['text/plain'].text(),
      html: await item.items['text/html'].text(),
    }
  }

  it('writes both rich and plain text when the browser supports it', async () => {
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    const write = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn()
    install('clipboard', { write, writeText })

    await expect(copyText('Hi', { html: '<b>Hi</b>' })).resolves.toBe('copied')
    expect(await written(write)).toEqual({ plain: 'Hi', html: '<b>Hi</b>' })
    expect(writeText).not.toHaveBeenCalled()
  })

  it('appends the url to both versions, escaped as a link in the rich one', async () => {
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    const write = vi.fn().mockResolvedValue(undefined)
    install('clipboard', { write, writeText: vi.fn() })

    await copyText('Hi', { html: '<b>Hi</b>', url: 'https://example.com/?a=1&b="2"' })
    expect(await written(write)).toEqual({
      plain: 'Hi\n\nhttps://example.com/?a=1&b="2"',
      html: '<b>Hi</b><br><br><a href="https://example.com/?a=1&amp;b=&quot;2&quot;">https://example.com/?a=1&amp;b="2"</a>',
    })
  })

  it('copies plain text when the browser has no ClipboardItem', async () => {
    const writeText = installClipboard()
    await expect(copyText('Hi', { html: '<b>Hi</b>' })).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith('Hi')
  })

  it('falls back to plain text when the rich write is refused', async () => {
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    const writeText = vi.fn().mockResolvedValue(undefined)
    install('clipboard', { write: vi.fn().mockRejectedValue(new Error('denied')), writeText })

    await expect(copyText('Hi', { html: '<b>Hi</b>' })).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith('Hi')
  })

  it('gives the share sheet only the plain text', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    install('share', share)
    await shareText('Hi', { html: '<b>Hi</b>' })
    expect(share).toHaveBeenCalledWith({ text: 'Hi' })
  })
})
