import { defineConfig, devices } from "@playwright/test";

// UI end-to-end tests (tests/ui/*.e2e.ts), run in GitHub Actions by .github/workflows/e2e-ui.yml.
// Target = E2E_BASE_URL (incl. /classicsudoku), default production; read in tests/ui/helpers.ts. Nothing touches the
// database: the game lives in the browser (localStorage) and no test sends feedback.

export default defineConfig({
  testDir: "tests/ui",
  // *.e2e.ts, not *.spec.ts: Vitest picks up every *.spec.ts / *.test.ts.
  testMatch: "**/*.e2e.ts",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  workers: 2,
  fullyParallel: true,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    locale: "ro-RO",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    // The game is for an Android phone: Chromium with Pixel 7 size, touch and user agent.
    { name: "android-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
