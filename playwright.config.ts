import { defineConfig, devices } from "@playwright/test";

const port = 4321;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 8,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: {
    timeout: 6_000
  },
  use: {
    baseURL,
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
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], colorScheme: "light" }
    },
    {
      name: "firefox-desktop",
      use: { ...devices["Desktop Firefox"], colorScheme: "light" }
    },
    {
      name: "webkit-desktop",
      use: { ...devices["Desktop Safari"], colorScheme: "light" }
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], colorScheme: "light" }
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 13"], colorScheme: "light" }
    }
  ]
});
