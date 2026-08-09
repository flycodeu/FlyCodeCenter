import { defineConfig, devices } from "@playwright/test";

const port = 4321;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/performance",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-performance" }]],
  timeout: 75_000,
  expect: {
    timeout: 8_000
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    colorScheme: "light",
    locale: "zh-CN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: `npm run dev:astro -- --ignore-lock --host 127.0.0.1 --port ${port}`,
    env: { ASTRO_DEV_BACKGROUND: "0" },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: "performance-chromium"
    }
  ]
});
