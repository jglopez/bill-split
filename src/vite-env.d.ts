/// <reference types="vite/client" />

/** Short commit SHA of this build; 'dev' when git was unavailable at build time. */
declare const __BUILD_ID__: string
/** Release tag of this build (e.g. v1.2.3); 'unreleased' when untagged at build time. */
declare const __APP_VERSION__: string
