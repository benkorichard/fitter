import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const appVersion = process.env.VITE_APP_VERSION || process.env.npm_package_version || 'dev'

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
})
