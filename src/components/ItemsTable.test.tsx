import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ItemsTable } from './ItemsTable'
import { SM_BREAKPOINT_PX } from '../hooks/useIsMobile'
import type { Item, Participant } from '../types'

const alice: Participant = { id: 'a', name: 'Alice' }
const bob: Participant = { id: 'b', name: 'Bob' }

const DEFAULT_WIDTH = window.innerWidth
const NARROW_WIDTH = SM_BREAKPOINT_PX - 1
const WIDE_WIDTH = SM_BREAKPOINT_PX

function setInnerWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
  window.dispatchEvent(new Event('resize'))
}

afterEach(() => {
  setInnerWidth(DEFAULT_WIDTH)
})

function beforeEachSetWidth(width: number) {
  beforeEach(() => {
    setInnerWidth(width)
  })
}

/** Opens the participant list of the first item card (cards layout only). */
function openFirstCard() {
  const [summary] = screen.queryAllByRole('button', { expanded: false })
  if (summary) fireEvent.click(summary)
}

function baseProps() {
  return {
    participants: [alice, bob],
    items: [
      { id: 'i1', name: 'Dinner', price: '10', assignedTo: null },
      { id: 'i2', name: '', price: '', assignedTo: null }, // trailing blank row
    ] as Item[],
    onUpdateItem: vi.fn(),
    onRemoveItem: vi.fn(),
    onReorderItems: vi.fn(),
    onReorderColumns: vi.fn(),
  }
}

// Both layouts expose the same controls under the same accessible names, so
// every behavior test runs against each of them. Cards start closed, so the
// cards run opens the first item's card first, the way a person would.
describe.each([
  { layout: 'table', width: WIDE_WIDTH },
  { layout: 'cards', width: NARROW_WIDTH },
])('ItemsTable ($layout layout)', ({ layout, width }) => {
  beforeEachSetWidth(width)

  function renderItems(ui: React.ReactElement) {
    const result = render(ui)
    if (layout === 'cards') openFirstCard()
    return result
  }

  it('shows a placeholder message when there are no participants', () => {
    renderItems(<ItemsTable {...baseProps()} participants={[]} />)
    expect(screen.getByText('Add participants above to start entering items.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Items' })).not.toBeInTheDocument()
  })

  it('lists participants in participant order', () => {
    renderItems(<ItemsTable {...baseProps()} participants={[bob, alice]} />)
    const bobBox = screen.getByLabelText('Assign "Dinner" to Bob')
    const aliceBox = screen.getByLabelText('Assign "Dinner" to Alice')
    expect(bobBox.compareDocumentPosition(aliceBox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders a row per item including the trailing blank row', () => {
    renderItems(<ItemsTable {...baseProps()} />)
    expect(screen.getAllByLabelText('Item description')).toHaveLength(2)
    expect(screen.getByDisplayValue('Dinner')).toBeInTheDocument()
  })

  it('calls onUpdateItem when the item name changes', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    renderItems(<ItemsTable {...props} />)
    await user.type(screen.getByDisplayValue('Dinner'), 'X')
    expect(props.onUpdateItem).toHaveBeenCalledWith({ ...props.items[0], name: 'DinnerX' })
  })

  it('calls onUpdateItem when the item price changes', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    renderItems(<ItemsTable {...props} />)
    await user.type(screen.getAllByLabelText('Item price')[1], '5')
    expect(props.onUpdateItem).toHaveBeenCalledWith({ ...props.items[1], price: '5' })
  })

  it('flags an invalid price', () => {
    const props = baseProps()
    props.items[0].price = 'abc'
    renderItems(<ItemsTable {...props} />)
    expect(screen.getAllByLabelText('Item price')[0]).toHaveAttribute('aria-invalid', 'true')
  })

  it('toggles taxable via the switch, and hides the switch on the blank row', () => {
    renderItems(<ItemsTable {...baseProps()} />)
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(1) // only the non-blank row has a taxable toggle
    expect(switches[0]).toHaveAttribute('aria-checked', 'true')
  })

  it('unsets taxable when the switch is clicked on a taxable item', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    renderItems(<ItemsTable {...props} />)
    await user.click(screen.getByRole('switch'))
    expect(props.onUpdateItem).toHaveBeenCalledWith({ ...props.items[0], taxable: false })
  })

  it('re-enables taxable when the switch is clicked on a non-taxable item', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    props.items[0].taxable = false
    renderItems(<ItemsTable {...props} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    await user.click(screen.getByRole('switch'))
    expect(props.onUpdateItem).toHaveBeenCalledWith({ ...props.items[0], taxable: undefined })
  })

  it('shows each participant assigned and their per-person share when assignedTo is null', () => {
    renderItems(<ItemsTable {...baseProps()} />)
    expect(screen.getByLabelText('Assign "Dinner" to Alice')).toBeChecked()
    expect(screen.getByLabelText('Assign "Dinner" to Bob')).toBeChecked()
    expect(screen.getAllByText('5.00')).toHaveLength(2) // $10 split 2 ways
  })

  it('unassigning a participant calls onUpdateItem with an explicit subset', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    renderItems(<ItemsTable {...props} />)
    await user.click(screen.getByLabelText('Assign "Dinner" to Bob'))
    expect(props.onUpdateItem).toHaveBeenCalledWith({ ...props.items[0], assignedTo: ['a'] })
  })

  it('re-checking a partially assigned participant adds them back to the subset', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    props.items[0].assignedTo = ['a']
    renderItems(<ItemsTable {...props} />)
    await user.click(screen.getByLabelText('Assign "Dinner" to Bob'))
    expect(props.onUpdateItem).toHaveBeenCalledWith({ ...props.items[0], assignedTo: ['a', 'b'] })
  })

  it('the "all" checkbox is checked when assignedTo is null and deselects everyone when clicked', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    renderItems(<ItemsTable {...props} />)
    const allCheckbox = screen.getByLabelText('Assign "Dinner" to all participants')
    expect(allCheckbox).toBeChecked()
    await user.click(allCheckbox)
    expect(props.onUpdateItem).toHaveBeenCalledWith({ ...props.items[0], assignedTo: [] })
  })

  it('the "all" checkbox re-assigns everyone via the null sentinel when clicked from a partial state', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    props.items[0].assignedTo = ['a']
    renderItems(<ItemsTable {...props} />)
    const allCheckbox = screen.getByLabelText('Assign "Dinner" to all participants')
    expect(allCheckbox).not.toBeChecked()
    await user.click(allCheckbox)
    expect(props.onUpdateItem).toHaveBeenCalledWith({ ...props.items[0], assignedTo: null })
  })

  it('shows no dollar share for an unassigned participant', () => {
    const props = baseProps()
    props.items[0].assignedTo = ['a']
    renderItems(<ItemsTable {...props} />)
    expect(screen.getByLabelText('Assign "Dinner" to Bob')).not.toBeChecked()
    expect(screen.getAllByText('10.00').length).toBeGreaterThan(0) // Alice gets the full share
    expect(screen.queryByText('0.00')).not.toBeInTheDocument()
  })

  it('hides the "all" checkbox and assign checkboxes on the blank row', () => {
    renderItems(<ItemsTable {...baseProps()} />)
    expect(screen.queryByLabelText('Assign "item" to all participants')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Assign "item" to Alice')).not.toBeInTheDocument()
  })

  it('calls onRemoveItem when the remove button is clicked, and hides it on the blank row', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    renderItems(<ItemsTable {...props} />)
    expect(screen.getAllByLabelText(/^Remove /)).toHaveLength(1) // only the non-blank row
    await user.click(screen.getByLabelText('Remove "Dinner"'))
    expect(props.onRemoveItem).toHaveBeenCalledWith('i1')
  })
})


describe('ItemsTable (table layout only)', () => {
  beforeEachSetWidth(WIDE_WIDTH)

  it('renders a table with a column header per participant in participant order', () => {
    render(<ItemsTable {...baseProps()} participants={[bob, alice]} />)
    expect(screen.queryByRole('list', { name: 'Items' })).not.toBeInTheDocument()
    const headers = screen.getAllByRole('columnheader').map(h => h.textContent)
    expect(headers.indexOf('Bob')).toBeLessThan(headers.indexOf('Alice'))
  })

  it('shows a dash in the cell of an unassigned participant', () => {
    const props = baseProps()
    props.items[0].assignedTo = ['a']
    render(<ItemsTable {...props} />)
    expect(screen.getByLabelText('Assign "Dinner" to Bob').closest('td')).toHaveTextContent('—')
  })
})

describe('ItemsTable (cards layout only)', () => {
  beforeEachSetWidth(NARROW_WIDTH)

  it('renders one card per item, including the blank one, and no table', () => {
    render(<ItemsTable {...baseProps()} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const cards = within(screen.getByRole('list', { name: 'Items' })).getAllByRole('listitem')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByDisplayValue('Dinner')).toBeInTheDocument()
  })

  it('starts closed, summarizing who shares the item', () => {
    render(<ItemsTable {...baseProps()} />)
    const card = screen.getAllByRole('listitem')[0]
    const summary = within(card).getByRole('button', { expanded: false })
    expect(summary).toHaveTextContent('Everyone5.00 each')
    expect(within(card).queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it.each([
    { assignedTo: ['b'], taxable: undefined, text: 'Bob10.00' },
    { assignedTo: ['b', 'a'], taxable: undefined, text: 'Alice, Bob5.00 each' }, // participant order
    { assignedTo: ['a', 'b', 'c', 'd'], taxable: undefined, text: 'Everyone2.50 each' },
    { assignedTo: ['a', 'c', 'd'], taxable: undefined, text: 'Everyone but Bob3.33 each' },
    { assignedTo: [], taxable: undefined, text: 'No one' },
    { assignedTo: null, taxable: false, text: 'Everyone2.50 eachno tax' },
  ])('summarizes $assignedTo (taxable: $taxable) as "$text"', ({ assignedTo, taxable, text }) => {
    const props = baseProps()
    props.participants = [alice, bob, { id: 'c', name: 'Carol' }, { id: 'd', name: 'Dan' }]
    props.items[0] = { ...props.items[0], assignedTo, taxable }
    render(<ItemsTable {...props} />)
    expect(screen.getAllByRole('button', { expanded: false })[0]).toHaveTextContent(text)
  })

  it('names the item in the summary button for screen readers', () => {
    const props = baseProps()
    props.items[0].taxable = false
    render(<ItemsTable {...props} />)
    expect(screen.getByRole('button', { name: 'Split of "Dinner": Everyone, 5.00 each, no tax' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens one card at a time', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    props.items = [
      { id: 'i1', name: 'Dinner', price: '10', assignedTo: null },
      { id: 'i2', name: 'Wine', price: '20', assignedTo: null },
      { id: 'i3', name: '', price: '', assignedTo: null },
    ]
    render(<ItemsTable {...props} />)
    const [dinner, wine] = screen.getAllByRole('listitem')
    await user.click(within(dinner).getByRole('button', { expanded: false }))
    expect(within(dinner).getByLabelText('Assign "Dinner" to Alice')).toBeInTheDocument()

    await user.click(within(wine).getByRole('button', { expanded: false }))
    expect(within(wine).getByLabelText('Assign "Wine" to Alice')).toBeInTheDocument()
    expect(within(dinner).queryByRole('checkbox')).not.toBeInTheDocument()

    await user.click(within(wine).getByRole('button', { expanded: true }))
    expect(within(wine).queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('lists one participant per line, with their share, then "Everyone", when open', () => {
    render(<ItemsTable {...baseProps()} />)
    openFirstCard()
    const card = screen.getAllByRole('listitem')[0]
    const boxes = within(card).getAllByRole('checkbox')
    expect(boxes.map(c => c.getAttribute('aria-label'))).toEqual([
      'Assign "Dinner" to Alice',
      'Assign "Dinner" to Bob',
      'Assign "Dinner" to all participants',
    ])
    expect(within(card).getByLabelText('Assign "Dinner" to Alice').closest('label')).toHaveTextContent('Alice5.00')
  })

  it('keeps the share slot for an unassigned participant, so toggling never shifts the layout', () => {
    const props = baseProps()
    props.items[0].assignedTo = ['a']
    render(<ItemsTable {...props} />)
    openFirstCard()
    expect(screen.getByLabelText('Assign "Dinner" to Bob').closest('label')).toHaveTextContent('Bob—')
  })

  it('shows only description and price on the blank card', () => {
    render(<ItemsTable {...baseProps()} />)
    const blank = screen.getAllByRole('listitem')[1]
    expect(within(blank).getByLabelText('Item description')).toBeInTheDocument()
    expect(within(blank).getByLabelText('Item price')).toBeInTheDocument()
    expect(within(blank).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(within(blank).queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps a drag grip on item cards but not on the blank card', () => {
    render(<ItemsTable {...baseProps()} />)
    const [item, blank] = screen.getAllByRole('listitem')
    expect(within(item).getByLabelText('Drag to reorder item')).toBeInTheDocument()
    expect(within(blank).queryByLabelText('Drag to reorder item')).not.toBeInTheDocument()
  })
})

describe('ItemsTable layout switching', () => {
  it('switches between cards and the table at the sm breakpoint', () => {
    setInnerWidth(NARROW_WIDTH)
    render(<ItemsTable {...baseProps()} />)
    expect(screen.getByRole('list', { name: 'Items' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    act(() => setInnerWidth(WIDE_WIDTH))
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Items' })).not.toBeInTheDocument()

    act(() => setInnerWidth(NARROW_WIDTH))
    expect(screen.getByRole('list', { name: 'Items' })).toBeInTheDocument()
  })
})
