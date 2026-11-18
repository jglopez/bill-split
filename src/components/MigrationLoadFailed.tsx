import { refreshCachedPage } from '../lib/refreshCachedPage'

// A stale cached page is one reason the migration chunk can be missing (it
// points at a chunk a newer deploy removed), so refresh the page before reloading.
async function reloadFresh() {
  await refreshCachedPage()
  window.location.reload()
}

/** Shown instead of the app when the code to upgrade a saved bill couldn't be fetched. */
export function MigrationLoadFailed() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div role="alert" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-sm text-center">
        <h1 className="text-base font-semibold text-gray-900 mb-2">Couldn't open your saved bill</h1>
        <p className="text-sm text-gray-500 mb-6">
          Your bill is still saved. Check your connection, then reload.
        </p>
        <button
          onClick={() => void reloadFresh()}
          className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors min-h-[44px]"
        >
          Reload
        </button>
      </div>
    </div>
  )
}
