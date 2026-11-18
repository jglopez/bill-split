import type { ReactNode } from 'react'
import type { Root } from 'react-dom/client'
import { MigrationLoadError } from './lib/migrations'

export function MigrationLoadFailed() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div role="alert" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-sm text-center">
        <h1 className="text-base font-semibold text-gray-900 mb-2">Couldn't open your saved bill</h1>
        <p className="text-sm text-gray-500 mb-6">
          Your bill is still saved. Check your connection, then reload.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors min-h-[44px]"
        >
          Reload
        </button>
      </div>
    </div>
  )
}

/**
 * Render the app once saved data is ready. If upgrading an old saved bill
 * fails because its code couldn't be fetched, show a reload prompt instead of
 * the app: the app saves on mount, which would replace the old bill.
 */
export function bootstrap(root: Root, prepare: () => Promise<void>, app: ReactNode): Promise<void> {
  return prepare().then(
    () => root.render(app),
    (err: unknown) => root.render(err instanceof MigrationLoadError ? <MigrationLoadFailed /> : app),
  )
}
