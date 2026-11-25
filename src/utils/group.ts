import type { Participant } from '../types'

/**
 * How to name a group of people drawn from a larger pool, such as the
 * people sharing an item out of everyone on the bill.
 *
 * - `everyone`: the group is the whole pool, and the pool has more than one
 *   person. With one person, naming them says more than "everyone".
 * - `everyoneBut`: the group is most of the pool, so `names` lists the people
 *   left out, because that list is shorter.
 * - `names`: `names` lists the group itself. An empty list means no one.
 */
export type GroupSummary =
  | { kind: 'everyone' }
  | { kind: 'everyoneBut'; names: string[] }
  | { kind: 'names'; names: string[] }

/**
 * Summarize which people in `pool` are in a group, naming whichever side is
 * shorter so a mostly-shared item doesn't list nearly everyone. On a tie the
 * group's own names win, since they're the people the reader is looking for.
 * Names come out in pool order. Every place that says who shares an item
 * uses this, so they never disagree.
 */
export function summarizeGroup(
  pool: Participant[],
  isMember: (participant: Participant) => boolean,
): GroupSummary {
  const members = pool.filter(isMember)
  const left = pool.filter(p => !isMember(p))
  if (left.length === 0 && pool.length > 1) return { kind: 'everyone' }
  if (left.length > 0 && left.length < members.length) {
    return { kind: 'everyoneBut', names: left.map(p => p.name) }
  }
  return { kind: 'names', names: members.map(p => p.name) }
}

/** Join names as running text: "Sam", "Sam and Alex", "Sam, Alex, and Jo". */
export function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(' and ')
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

/**
 * A group summary as words: "Sam and Alex", "everyone", or "everyone but
 * Jo". An empty group gives an empty string, so callers pick their own
 * wording for no one. `capitalize` capitalizes "everyone" to start a line;
 * names are never changed.
 */
export function describeGroup(summary: GroupSummary, capitalize = false): string {
  const everyone = capitalize ? 'Everyone' : 'everyone'
  if (summary.kind === 'everyone') return everyone
  if (summary.kind === 'everyoneBut') return `${everyone} but ${joinNames(summary.names)}`
  return joinNames(summary.names)
}
