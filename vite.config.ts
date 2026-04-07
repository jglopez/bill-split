import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The base path must match the deployment path (repo name).
// If you migrate to a custom domain or a host that serves from the root,
// remove this or drive it via an environment variable.
export default defineConfig({
  plugins: [react()],
  base: '/bill-split/',
})
