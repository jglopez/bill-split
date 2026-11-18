/**
 * Re-fetch the app's HTML past the HTTP cache, so a following
 * `location.reload()` gets the deployed page instead of a stale cached one.
 * Installed web apps can otherwise keep serving an old page indefinitely.
 * Never rejects: the reload is still worth trying if this fails.
 */
export async function refreshCachedPage(): Promise<void> {
  try {
    await fetch(import.meta.env.BASE_URL, { cache: 'reload' })
  } catch {
    // Reload anyway; the browser may still revalidate.
  }
}
