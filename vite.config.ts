import path from 'node:path'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  appType: 'custom',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  ssr: {
    external: Object.keys(pkg.dependencies ?? {}),
  },
  build: {
    ssr: 'src/main.ts',
    outDir: 'dist',
    sourcemap: true,
    minify: false,
    rollupOptions: {
      external: [/^node:.*/],
      output: {
        entryFileNames: 'server.mjs',
        chunkFileNames: 'chunks/[name]-[hash].mjs',
        format: 'esm',
      },
    },
  },
})
