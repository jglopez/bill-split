import { describe, it, expect } from 'vitest'
import { isItemBlank } from './items'

describe('isItemBlank', () => {
  const blank = { id: 'i1', name: '', price: '', assignedTo: null }

  it('is true with no name and no price, ignoring whitespace', () => {
    expect(isItemBlank(blank)).toBe(true)
    expect(isItemBlank({ ...blank, name: '  ', price: ' ' })).toBe(true)
  })

  it('is false once either a name or a price is typed', () => {
    expect(isItemBlank({ ...blank, name: 'Taco' })).toBe(false)
    expect(isItemBlank({ ...blank, price: '5' })).toBe(false)
  })
})
