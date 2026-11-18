import { createElement, type ReactNode } from 'react'
import type { Root } from 'react-dom/client'
import { MigrationLoadFailed } from './components/MigrationLoadFailed'
import { MigrationLoadError } from './lib/migrations'

/**
 * Render the app once saved data is ready. If upgrading an old saved bill
 * fails because its code couldn't be fetched, show a reload prompt instead of
 * the app: the app saves on mount, which would replace the old bill.
 */
export function bootstrap(root: Root, prepare: () => Promise<void>, app: ReactNode): Promise<void> {
  return prepare().then(
    () => root.render(app),
    (err: unknown) => root.render(err instanceof MigrationLoadError ? createElement(MigrationLoadFailed) : app),
  )
}
