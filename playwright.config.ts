import { defineConfig, devices } from '@playwright/test'

// E2E laufen gegen den Production-Build (`next start`) auf Port 3100, damit ein
// evtl. laufender Dev-Server (3000) nicht kollidiert. Vor dem Lauf muss ein
// aktueller Build existieren (`npm run build`). Ein einziger Worker, weil die
// Tests echte Daten in der Live-DB anlegen und sich sonst gegenseitig stoeren.
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run start -- -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
