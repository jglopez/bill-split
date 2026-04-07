import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The base path must match the GitHub Pages deployment path (repo name).
// If you migrate to a custom domain or Cloudflare Pages at the root,
// remove this or drive it via an environment variable.
export default defineConfig({
  plugins: [react()],
  base: '/bill-split/',
})
