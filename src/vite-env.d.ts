/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

/** Short commit SHA of this build; 'dev' when git was unavailable at build time. */
declare const __BUILD_ID__: string
/** Release tag of this build (e.g. v1.2.3); 'unreleased' when untagged at build time. */
declare const __APP_VERSION__: string
/** Branch of a preview deployment; null in production, so the footer shows nothing extra. */
declare const __PREVIEW_BRANCH__: string | null
/** Pull request (or PR search) a preview was built from; null in production. */
declare const __PREVIEW_PR_URL__: string | null
