import { defineConfig } from "@playwright/test";

const widths = [360, 390, 412, 430];

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: widths.map((width) => ({
    name: `mobile-${width}`,
    use: {
      viewport: { width, height: 915 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true
    }
  }))
});
