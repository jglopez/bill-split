import { Liquid } from 'liquidjs'
import { formatMoney } from '../../utils/format'
import type { SummaryTemplateData } from './templateData'
import defaultTemplate from './default.liquid?raw'

export { defaultTemplate }

/** Thrown when a template can't be parsed or rendered. Nothing partial is returned. */
export class SummaryTemplateError extends Error {
  /** The engine's own error, for debugging. */
  readonly cause: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'SummaryTemplateError'
    this.cause = cause
  }
}

/**
 * LiquidJS is used because its templates can't run arbitrary code, so the
 * same engine stays safe if users ever write their own templates. Settings
 * that matter for that:
 * - An empty in-memory template map, so `include`, `render` and `layout`
 *   can't fetch anything.
 * - Strict filters and variables, so a typo fails loudly instead of
 *   silently printing nothing.
 * - Own properties only, so templates can't reach prototype members.
 * - Parse, render and memory limits, so a runaway template can't hang the
 *   page. They are generous for anything a person would write by hand.
 */
const engine = new Liquid({
  templates: {},
  strictFilters: true,
  strictVariables: true,
  ownPropertyOnly: true,
  parseLimit: 100_000,
  renderLimit: 1_000,
  memoryLimit: 10_000_000,
})

// Formats a dollar amount the same way the app does.
engine.registerFilter('money', (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`money expects a number, got ${JSON.stringify(value)}`)
  }
  return formatMoney(value)
})

/**
 * Render the plain-text summary of a bill. Trailing whitespace on each line
 * and blank lines at either end are trimmed, so templates can be laid out
 * for readability.
 *
 * Throws SummaryTemplateError if the template is malformed or fails while
 * rendering.
 */
export function renderSummary(
  data: SummaryTemplateData,
  template: string = defaultTemplate,
): string {
  let output: string
  try {
    const parsed = engine.parse(template)
    output = engine.renderSync(parsed, data)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new SummaryTemplateError(`Summary template failed: ${detail}`, error)
  }
  return output
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/^\n+|\n+$/g, '')
}
