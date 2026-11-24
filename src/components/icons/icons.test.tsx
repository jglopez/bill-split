import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

// Every icon file in this folder, loaded as a React component the same way the
// app imports them, so a new icon is covered without editing this test.
const icons = import.meta.glob<{ default: React.FC<React.SVGProps<SVGSVGElement>> }>('./*.svg', {
  query: '?react',
  eager: true,
})

describe('icon files', () => {
  it('finds the icons', () => {
    expect(Object.keys(icons).length).toBeGreaterThan(0)
  })

  for (const [path, mod] of Object.entries(icons)) {
    describe(path, () => {
      it('renders an inline svg that takes the props it is given', () => {
        const Icon = mod.default
        const { container } = render(<Icon className="size-test" aria-hidden="true" />)
        const svg = container.querySelector('svg')
        expect(svg).not.toBeNull()
        expect(svg).toHaveAttribute('viewBox')
        expect(svg).toHaveClass('size-test')
        expect(svg).toHaveAttribute('aria-hidden', 'true')
      })

      it('paints with currentColor so it follows the surrounding text color', () => {
        const { container } = render(<mod.default />)
        const svg = container.querySelector('svg')!
        const paint = [svg.getAttribute('fill'), svg.getAttribute('stroke')]
        expect(paint).toContain('currentColor')
        expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i)
      })
    })
  }
})
