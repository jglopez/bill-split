import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BillNameInput } from './BillNameInput'

describe('BillNameInput', () => {
  it('shows the placeholder when empty', () => {
    render(<BillNameInput name="" onChange={() => {}} />)
    expect(screen.getByPlaceholderText('Bill name')).toHaveValue('')
  })

  it('shows the current name', () => {
    render(<BillNameInput name="Ski trip" onChange={() => {}} />)
    expect(screen.getByLabelText('Bill name')).toHaveValue('Ski trip')
  })

  it('reports typed text', async () => {
    const onChange = vi.fn()
    render(<BillNameInput name="" onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('Bill name'), 'A')
    expect(onChange).toHaveBeenCalledWith('A')
  })
})
