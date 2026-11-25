// ─── Bill links ───────────────────────────────────────────────────────────────
//
// The one place that turns a bill into a link and a link back into a bill.
// Anything that produces or opens links (the share summary today, other share
// methods later) goes through here.
//
// A link is the app's URL with the bill in the fragment:
//
//   <app URL>#b=<format>.<data>
//
// <format> says how <data> is laid out (see formats/). <data> is the packed
// bill as JSON, raw-deflated, then base64url-encoded. Each format is tied to
// the bill schema version it was written for, so opening an old link goes
// through the same migrations as an old saved bill.
//
// Links already shared must keep opening, so a format never changes once
// released. To change the layout, or when the bill schema changes, add a new
// format and make it the latest. billLink.test.ts fails until the latest
// format matches the current schema, and pins a link from every format.

import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate'
import type { BillState } from '../../types'
import { CURRENT_BILL_VERSION, MigrationLoadError, migrateToCurrent } from '../../lib/migrations'
import { isBillState } from '../../hooks/useBillSplit'
import { BILL_HASH_PREFIX, isBillHash, splitBillHash, withPerson } from './hash'
import * as v1 from './formats/v1'

interface LinkFormat {
  /** The bill schema version that unpack produces. */
  SCHEMA_VERSION: number
  unpack: (data: unknown) => unknown
}

/** Every format that links may be in, by number. Never remove one. */
export const formats: Readonly<Record<number, LinkFormat>> = {
  1: v1,
}

/** The format new links are written in. */
export const LATEST_LINK_FORMAT = 1
const latest = v1

/** The link is damaged, truncated, or not a bill link at all. */
export class MalformedLinkError extends Error {
  readonly cause: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'MalformedLinkError'
    this.cause = cause
  }
}

/** The link was made by a newer version of the app. The app should update. */
export class NewerLinkError extends Error {
  readonly format: number
  constructor(format: number) {
    super(`Bill link format ${format} is newer than this app (format ${LATEST_LINK_FORMAT})`)
    this.name = 'NewerLinkError'
    this.format = format
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new MalformedLinkError('Bill link has characters outside base64url')
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  let binary: string
  try {
    binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  } catch (err) {
    throw new MalformedLinkError('Bill link data is not valid base64url', err)
  }
  return Uint8Array.from(binary, ch => ch.charCodeAt(0))
}

/**
 * The URL fragment, including its `#`, that opens this bill. Synchronous so
 * share buttons can build it during the tap itself.
 */
export function encodeBillHash(state: BillState): string {
  const json = JSON.stringify(latest.pack(state))
  return `${BILL_HASH_PREFIX}${LATEST_LINK_FORMAT}.${toBase64Url(deflateSync(strToU8(json), { level: 9 }))}`
}

/** The app's own address, without any fragment. */
export function appBaseUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href
}

/** A full link that opens this bill in the app. */
export function billLinkUrl(state: BillState, base: string = appBaseUrl()): string {
  return base.replace(/#.*$/, '') + encodeBillHash(state)
}

/**
 * A full link that opens this bill in the app and scrolls to one person's
 * receipt. Throws when the person isn't on the bill.
 */
export function personLinkUrl(state: BillState, participantId: string, base: string = appBaseUrl()): string {
  const position = state.participants.findIndex(p => p.id === participantId)
  if (position === -1) throw new RangeError(`Participant ${participantId} is not on the bill`)
  return base.replace(/#.*$/, '') + withPerson(encodeBillHash(state), position)
}

/**
 * Read a bill from a URL fragment (including its `#`). The result is a
 * current-version bill with fresh ids. A person marker is ignored here; see
 * splitBillHash.
 *
 * Rejects with NewerLinkError for links from a newer app, MalformedLinkError
 * for anything damaged, and MigrationLoadError when the code to upgrade an
 * old link couldn't be fetched (the link itself may be fine).
 */
export async function decodeBillHash(hash: string): Promise<BillState> {
  if (!isBillHash(hash)) throw new MalformedLinkError('Not a bill link')
  // A person marker only says where to scroll; the bill is the same.
  const billHash = splitBillHash(hash).bill
  const match = /^(\d{1,6})\.(.*)$/s.exec(billHash.slice(BILL_HASH_PREFIX.length))
  if (!match) throw new MalformedLinkError('Bill link has no format number')

  const formatNumber = Number(match[1])
  if (formatNumber > LATEST_LINK_FORMAT) throw new NewerLinkError(formatNumber)
  const format = formats[formatNumber]
  if (!format) throw new MalformedLinkError(`Unknown bill link format ${formatNumber}`)

  let packed: unknown
  try {
    packed = JSON.parse(strFromU8(inflateSync(fromBase64Url(match[2]))))
  } catch (err) {
    if (err instanceof MalformedLinkError) throw err
    throw new MalformedLinkError('Bill link data is truncated or corrupt', err)
  }

  let bill: unknown
  try {
    bill = format.unpack(packed)
  } catch (err) {
    throw new MalformedLinkError('Bill link data has an unexpected shape', err)
  }

  if (format.SCHEMA_VERSION < CURRENT_BILL_VERSION) {
    try {
      bill = await migrateToCurrent(bill, format.SCHEMA_VERSION)
    } catch (err) {
      if (err instanceof MigrationLoadError) throw err
      throw new MalformedLinkError('Bill link could not be upgraded to the current bill', err)
    }
  }
  if (!isBillState(bill)) throw new MalformedLinkError('Bill link did not produce a valid bill')
  return bill
}
