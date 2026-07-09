import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Löst den `@/`-Alias (wie in tsconfig) auch für Vitest auf, damit Tests
// dieselben Importe wie die App nutzen können.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
