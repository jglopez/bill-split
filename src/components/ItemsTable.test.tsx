import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ItemsTable } from './ItemsTable'
import type { Item, Participant } from '../types'

const alice: Participant = { id: 'a', name: 'Alice' }
const bob: Participant = { id: 'b', name: 'Bob' }

function baseProps() {
  return {
    participants: [alice, bob],
    items: [
      { id: 'i1', name: 'Dinner', price: '10', assignedTo: null },
      { id: 'i2', name: '', price: '', assignedTo: null }, // trailing blank row
    ] as Item[],
    columnOrder: ['a', 'b'],
    onUpdateItem: vi.fn(),
    onRemoveItem: vi.fn(),
    onReorderItems: vi.fn(),
    onReorderColumns: vi.fn(),
  }
}

describe('ItemsTable', () => {
  it('shows a placeholder message when there are no participants', () => {
    render(<ItemsTable {...baseProps()} participants={[]} />)
    expect(screen.getByText('Add participants above to start entering items.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders a column header per participant in columnOrder', () => {
    render(<ItemsTable {...baseProps()} columnOrder={['b', 'a']} />)
    const headers = screen.getAllByRole('columnheader').map(h => h.textContent)
    expect(headers.indexOf('Bob')).toBeLessThan(headers.indexOf('Alice'))
  })

  it('renders a row per item including the trailing blank row', () => {
    render(<ItemsTable {...baseProps()} />)
    expect(screen.getAllByLabelText('Item description')).toHaveLength(2)
    expect(screen.getByDisplayValue('Dinner')).toBeInTheDocument()
  })

  it('calls onUpdateItem when the item name changes', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<ItemsTable {...props} />)
    await user.type(screen.getByDisplayValue('Dinner'), 'X')
    expect(props.onUpdateItem).toHaveBeenCalledWith({ ...props.items[0], name: 'DinnerX' })
  })

  it('calls onUpdateItem when the item price changes', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<ItemsTable {...props} />)
    await user.type(screen.getAllByLabelText('Item price')[1], '5')
    expect(props.onUpdateItem).toHaveBeenCalledWith({ ...props.items[1], price: '5' })
  })

  it('flags an invalid price', () => {
    const props = baseProps()
    props.items[0].price = 'abc'
    render(<ItemsTable {...props} />)
    expect(screen.getAllByLabelText('Item price')[0]).toHaveAttribute('aria-invalid', 'true')
  })

  it('toggles taxable via the switch, and hides the switch on the blank row', () => {
    render(<ItemsTable {...baseProps()} />)
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(1) // only the non-blank row has a taxable toggle
    expect(switches[0]).toHaveAttribute('aria-checked', 'true')
  })

  it('unsets taxable when the switch is clicked on a taxable item', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<ItemsTable {...props} />)
    await user.click(screen.getByRole('switch'))
    expect(props.onUpdateItem).toHaveBeenCalledWith({ ...props.items[0], taxable: false })
  })

  it('re-enables taxable when the switch is clicked on a non-taxable item', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    props.items[0].taxable = false
    render(<ItemsTable {...props} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    await user.click(screen.getByRole('switch'))
    expect(props.onUpdateItem).toHaveBeenCalledWith({ ...props.items[0], taxable: undefined })
  })

  it('shows each participant assigned and their per-person share when assignedTo is null', () => {
    render(<ItemsTable {...baseProps()} />)
    expect(screen.getByLabelText('Assign "Dinner" to Alice')).toBeChecked()
    expect(screen.getByLabelText('Assign "Dinner" to Bob')).toBeChecked()
    expect(screen.getAllByText('5.00')).toHaveLength(2) // $10 split 2 ways
  })

  it('unassigning a participant calls onUpdateItem with an explicit subset', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<ItemsTable {...props} />)
    await user.click(screen.getByLabelText('Assign "Dinner" to Bob'))
    expect(props.onUpdateItem).toHaveBeenCalledWith({ ...props.items[0], assignedTo: ['a'] })
  })

  it('re-checking a partially assigned participant adds them back to the subset', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    props.items[0].assignedTo = ['a']
    render(<ItemsTable {...props} />)
    await user.click(screen.getByLabelText('Assign "Dinner" to Bob'))
    expect(props.onUpdateItem).toHaveBeenCalledWith({ ...props.items[0], assignedTo: ['a', 'b'] })
  })

  it('the "all" checkbox is checked when assignedTo is null and deselects everyone when clicked', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<ItemsTable {...props} />)
    const allCheckbox = screen.getByLabelText('Assign "Dinner" to all participants')
    expect(allCheckbox).toBeChecked()
    await user.click(allCheckbox)
    expect(props.onUpdateItem).toHaveBeenCalledWith({ ...props.items[0], assignedTo: [] })
  })

  it('the "all" checkbox re-assigns everyone via the null sentinel when clicked from a partial state', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    props.items[0].assignedTo = ['a']
    render(<ItemsTable {...props} />)
    const allCheckbox = screen.getByLabelText('Assign "Dinner" to all participants')
    expect(allCheckbox).not.toBeChecked()
    await user.click(allCheckbox)
    expect(props.onUpdateItem).toHaveBeenCalledWith({ ...props.items[0], assignedTo: null })
  })

  it('shows a dash instead of a dollar share for an unassigned participant', () => {
    const props = baseProps()
    props.items[0].assignedTo = ['a']
    render(<ItemsTable {...props} />)
    const bobCheckbox = screen.getByLabelText('Assign "Dinner" to Bob')
    expect(bobCheckbox).not.toBeChecked()
    expect(bobCheckbox.closest('td')).toHaveTextContent('—')
    expect(screen.getByText('10.00')).toBeInTheDocument() // Alice gets the full share
  })

  it('hides the "all" checkbox and assign checkboxes on the blank row', () => {
    render(<ItemsTable {...baseProps()} />)
    expect(screen.queryByLabelText('Assign "item" to all participants')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Assign "item" to Alice')).not.toBeInTheDocument()
  })

  it('calls onRemoveItem when the remove button is clicked, and hides it on the blank row', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<ItemsTable {...props} />)
    expect(screen.getAllByLabelText(/^Remove /)).toHaveLength(1) // only the non-blank row
    await user.click(screen.getByLabelText('Remove "Dinner"'))
    expect(props.onRemoveItem).toHaveBeenCalledWith('i1')
  })
})
