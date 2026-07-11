import { defineConfig, devices } from '@playwright/test';

const appOrigin = 'http://localhost:5173';
const debugSpecs = '**/debug-*.spec.ts';
const standardProjectIgnores = ['**/dual-mode/**', debugSpecs];

const renderingModeStorageState = (mode: 'canvas2d' | 'webgl') => ({
  cookies: [],
  origins: [{
    origin: appOrigin,
    localStorage: [{ name: 'shibori:test-rendering-mode', value: mode }],
  }],
});

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
        storageState: renderingModeStorageState('canvas2d'),
      },
      testDir: './tests',
      testIgnore: standardProjectIgnores,
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
        storageState: renderingModeStorageState('webgl'),
      },
      testDir: './tests',
      testIgnore: standardProjectIgnores,
    },
    ...(process.env.SHIBORI_TEST_BACKEND_PARITY === 'true' ? [{
      name: 'chromium-backend-parity',
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
      },
      testDir: './tests/dual-mode',
      testIgnore: debugSpecs,
    }] : []),
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: appOrigin,
    reuseExistingServer: !process.env.CI,
  },
});
