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
// Marks bold text while rendering. Control characters can't come from a
// typed name, so they never collide with the bill's own text.
const BOLD_START = '\u0002'
const BOLD_END = '\u0003'

function makeEngine(bold: (text: string) => string): Liquid {
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

  // Bold in the rich-text copy; unchanged in plain text, so plain text never
  // shows markup.
  engine.registerFilter('bold', (value: unknown) => bold(String(value)))

  return engine
}

const textEngine = makeEngine(text => text)
const stripMarkers = (text: string) => text.split(BOLD_START).join('').split(BOLD_END).join('')
const BOLD_SPAN = new RegExp(`${BOLD_START}([^${BOLD_END}]*)${BOLD_END}`, 'g')
const htmlEngine = makeEngine(text => BOLD_START + stripMarkers(text) + BOLD_END)

function render(engine: Liquid, data: SummaryTemplateData, template: string): string {
  let output: string
  try {
    output = engine.renderSync(engine.parse(template), data)
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Render the plain-text summary of a bill. Trailing whitespace on each line
 * and blank lines at either end are trimmed, so templates can be laid out
 * for readability. The `bold` filter has no effect here.
 *
 * Throws SummaryTemplateError if the template is malformed or fails while
 * rendering.
 */
export function renderSummary(
  data: SummaryTemplateData,
  template: string = defaultTemplate,
): string {
  return render(textEngine, data, template)
}

/**
 * Render the same summary as rich text (HTML) for pasting into apps that
 * keep formatting. It has the same text and line breaks as renderSummary;
 * only text passed through the `bold` filter differs, wrapped in <b>.
 * Everything else is escaped, so names can't inject markup.
 *
 * Throws SummaryTemplateError like renderSummary.
 */
export function renderSummaryHtml(
  data: SummaryTemplateData,
  template: string = defaultTemplate,
): string {
  const body = escapeHtml(render(htmlEngine, data, template))
    .replace(BOLD_SPAN, '<b>$1</b>')
    .replace(/\n/g, '<br>')
  return `<div>${body}</div>`
}
