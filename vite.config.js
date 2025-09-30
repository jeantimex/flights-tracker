import { defineConfig } from 'vite'

export default defineConfig({
  base: '/flights-tracker/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  // Make sure assets in public folder are copied with correct paths
  publicDir: 'public',
})