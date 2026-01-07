import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    outDir: '../../static',
    emptyOutDir: false,
  },
  server: {
    port: 5174,
    proxy: {
      '/v1': {
        target: 'http://localhost:8317',
        changeOrigin: true,
      },
    },
  },
})
