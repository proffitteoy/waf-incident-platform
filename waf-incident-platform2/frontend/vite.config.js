import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
const frontendRoot = path.resolve('.')

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@vue/test-utils': path.resolve(
        frontendRoot,
        'node_modules/@vue/test-utils/dist/vue-test-utils.esm-bundler.mjs'
      ),
      vue: path.resolve(frontendRoot, 'node_modules/vue/dist/vue.runtime.esm-bundler.js'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(frontendRoot, '..')],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(frontendRoot, '../test/frontend/vitest.setup.ts')],
    include: ['../test/frontend/**/*.test.ts'],
  },
})
