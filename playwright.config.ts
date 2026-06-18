import { defineConfig, devices } from '@playwright/test'

const backendUrl = process.env.PLANOGRAM_BACKEND_URL ?? 'http://127.0.0.1:8080'
const frontendUrl = process.env.PLANOGRAM_FRONTEND_URL ?? 'http://127.0.0.1:5173'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: frontendUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: '../.venv/bin/python -m uvicorn main:app --port 8080',
      cwd: 'backend',
      url: `${backendUrl}/api/demo-accounts`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      cwd: 'frontend-react',
      url: frontendUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
