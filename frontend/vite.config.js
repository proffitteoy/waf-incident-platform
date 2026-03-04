import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
const frontendRoot = path.resolve('.')

export default defineConfig({
  plugins: [vue()],
  server: {
    fs: {
      allow: [path.resolve(frontendRoot)],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(frontendRoot, 'tests-layered/vitest.setup.ts')],
    include: ['tests-layered/**/*.test.ts'],
  },
})
