import { useEffect } from 'react'

/** sessionStorage key recording the build we last reloaded toward, to prevent reload loops. */
export const RELOAD_TARGET_KEY = 'bill-split:reload-target'

function readReloadTarget(): string | null {
  try {
    return sessionStorage.getItem(RELOAD_TARGET_KEY)
  } catch {
    return null
  }
}

function writeReloadTarget(build: string): boolean {
  try {
    sessionStorage.setItem(RELOAD_TARGET_KEY, build)
    return true
  } catch {
    return false
  }
}

/** Fetch the build ID currently deployed, bypassing every cache. Null on any failure. */
async function fetchDeployedBuild(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' })
    if (!res.ok) return null
    const data: unknown = await res.json()
    if (data && typeof data === 'object' && 'build' in data && typeof data.build === 'string') {
      return data.build
    }
    return null
  } catch {
    return null
  }
}

/**
 * Reloads the page when a newer build has been deployed.
 *
 * Installed web apps (e.g. iOS "Add to Home Screen") have no refresh control
 * and can keep serving a cached page indefinitely. This checks the deployed
 * version.json on launch and whenever the app returns to the foreground, and
 * reloads if it differs from the running build. Bill state is persisted on
 * every change, so reloading loses nothing.
 *
 * Pass `enabled: false` when state is not being persisted (a reload would
 * discard it). Only runs in production builds.
 */
export function useAutoUpdate({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || !import.meta.env.PROD || __BUILD_ID__ === 'dev') return

    let cancelled = false
    let inFlight = false

    async function check() {
      if (inFlight || document.visibilityState !== 'visible') return
      inFlight = true
      try {
        const deployed = await fetchDeployedBuild()
        if (cancelled || !deployed || deployed === __BUILD_ID__) return
        // Already tried reloading toward this build and still got the old
        // page back: stop rather than loop.
        if (readReloadTarget() === deployed) return
        if (!writeReloadTarget(deployed)) return
        // Refresh the cached HTML first so the reload doesn't get the stale page again.
        try {
          await fetch(import.meta.env.BASE_URL, { cache: 'reload' })
        } catch {
          // Reload anyway; the browser may still revalidate.
        }
        if (!cancelled) window.location.reload()
      } finally {
        inFlight = false
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void check()
    }
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) void check()
    }

    void check()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [enabled])
}
