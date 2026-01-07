import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: '../../static',
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: 'chat-ui.js',
      },
    },
  },
  server: {
    proxy: {
      '/v1': {
        target: 'http://localhost:8317',
        changeOrigin: true,
      },
    },
  },
})
