import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShareSection } from './ShareSection'

describe('ShareSection', () => {
  it('renders nothing without any share methods', () => {
    const { container } = render(<ShareSection />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a Share heading over its share methods', () => {
    render(
      <ShareSection>
        <button type="button">One</button>
        <button type="button">Two</button>
      </ShareSection>,
    )
    expect(screen.getByRole('region', { name: 'Share' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})
