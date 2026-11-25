import { describe, expect, it } from 'vitest'
import type { Participant } from '../types'
import { joinNames, summarizeGroup } from './group'

const people: Participant[] = ['Ann', 'Ben', 'Cal', 'Dee', 'Eli'].map((name, i) => ({ id: String(i), name }))

function summarize(pool: Participant[], memberNames: string[]) {
  return summarizeGroup(pool, p => memberNames.includes(p.name))
}

describe('summarizeGroup', () => {
  it('says everyone when the whole pool is in the group', () => {
    expect(summarize(people, people.map(p => p.name))).toEqual({ kind: 'everyone' })
  })

  it('names a pool of one rather than calling them everyone', () => {
    expect(summarize(people.slice(0, 1), ['Ann'])).toEqual({ kind: 'names', names: ['Ann'] })
  })

  it('names the people left out when that list is shorter', () => {
    expect(summarize(people, ['Ann', 'Cal', 'Dee', 'Eli'])).toEqual({ kind: 'everyoneBut', names: ['Ben'] })
    expect(summarize(people, ['Ann', 'Ben', 'Cal'])).toEqual({ kind: 'everyoneBut', names: ['Dee', 'Eli'] })
  })

  it('names the group itself on a tie or when the group is smaller', () => {
    expect(summarize(people.slice(0, 4), ['Ann', 'Ben'])).toEqual({ kind: 'names', names: ['Ann', 'Ben'] })
    expect(summarize(people, ['Eli', 'Ann'])).toEqual({ kind: 'names', names: ['Ann', 'Eli'] })
  })

  it('returns no names for an empty group or pool', () => {
    expect(summarize(people, [])).toEqual({ kind: 'names', names: [] })
    expect(summarize([], [])).toEqual({ kind: 'names', names: [] })
  })

  it('never names more people than it has to, for every group of the pool', () => {
    for (let mask = 0; mask < 1 << people.length; mask++) {
      const members = people.filter((_, i) => mask & (1 << i))
      const left = people.length - members.length
      const summary = summarizeGroup(people, p => members.includes(p))
      const named = summary.kind === 'everyone' ? 0 : summary.names.length
      expect(named).toBeLessThanOrEqual(Math.min(members.length, left))
    }
  })
})

describe('joinNames', () => {
  it.each([
    [[], ''],
    [['Ann'], 'Ann'],
    [['Ann', 'Ben'], 'Ann and Ben'],
    [['Ann', 'Ben', 'Cal'], 'Ann, Ben, and Cal'],
  ])('joins %j as "%s"', (names, text) => {
    expect(joinNames(names)).toBe(text)
  })
})
