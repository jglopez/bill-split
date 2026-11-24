import { Children, type ReactNode } from 'react'

interface Props {
  children?: ReactNode
}

/**
 * Where every way of getting the bill out of the app lives: summary text,
 * links, exports, payment requests. Each one is a child, usually a
 * ShareButton. Renders nothing until at least one share method is present.
 *
 * App decides when there's a bill worth sharing; this component only lays
 * the actions out.
 */
export function ShareSection({ children }: Props) {
  if (Children.toArray(children).length === 0) return null

  return (
    <section aria-labelledby="share-heading" className="mt-6">
      <h2
        id="share-heading"
        className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2"
      >
        Share
      </h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  )
}
