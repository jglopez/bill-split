import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BuildInfo } from './BuildInfo'

describe('BuildInfo', () => {
  it('shows only the version and build in production', () => {
    const { container } = render(<BuildInfo version="v1.2.3" build="abc1234" previewBranch={null} previewPrUrl={null} />)
    expect(container).toHaveTextContent(/^v1\.2\.3 · abc1234$/)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('flags a preview and names its branch instead of the version', () => {
    const { container } = render(<BuildInfo version="unreleased" build="abc1234" previewBranch="feat/x" previewPrUrl={null} />)
    expect(container).toHaveTextContent(/^Preview feat\/x · abc1234$/)
  })

  it('links the branch to its pull request', () => {
    render(<BuildInfo build="abc1234" previewBranch="feat/x" previewPrUrl="https://github.com/o/r/pull/7" />)
    expect(screen.getByRole('link', { name: 'feat/x' })).toHaveAttribute('href', 'https://github.com/o/r/pull/7')
  })
})
