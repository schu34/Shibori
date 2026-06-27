import { defineConfig, devices } from '@playwright/test';

/**
 * Shibori Canvas Testing Configuration
 * Supports both Canvas 2D and WebGL testing modes
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'line',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5173',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers with Canvas 2D and WebGL support */
  projects: [
    {
      name: 'chromium-canvas2d',
      use: { 
        ...devices['Desktop Chrome'],
        // Force Canvas 2D mode for baseline testing
        extraHTTPHeaders: {
          'X-Shibori-Test-Mode': 'canvas2d'
        }
      },
      testDir: './tests',
    },
    {
      name: 'chromium-webgl',
      use: { 
        ...devices['Desktop Chrome'],
        // Enable WebGL features and force WebGL mode
        launchOptions: {
          args: [
            '--enable-webgl',
            '--enable-webgl2-compute-context',
            '--enable-webgl-draft-extensions',
            '--enable-accelerated-2d-canvas',
            '--disable-web-security', // For testing purposes
          ]
        },
        extraHTTPHeaders: {
          'X-Shibori-Test-Mode': 'webgl'
        }
      },
      testDir: './tests',
    },
    // Dual-mode project for compatibility testing
    ...(process.env.SHIBORI_TEST_DUAL_MODE === 'true' ? [{
      name: 'chromium-dual-mode',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-webgl',
            '--enable-webgl2-compute-context',
            '--enable-webgl-draft-extensions',
            '--enable-accelerated-2d-canvas',
          ]
        },
        extraHTTPHeaders: {
          'X-Shibori-Test-Mode': 'dual'
        }
      },
      testDir: './tests/dual-mode',
    }] : []),
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
