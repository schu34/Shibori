/**
 * Test environment configuration for controlling Canvas 2D vs WebGL testing modes
 */

export interface TestEnvironmentConfig {
  /** Force specific rendering mode for all tests */
  forceRenderingMode?: 'canvas2d' | 'webgl' | 'auto';
  /** Enable dual-mode testing (test both Canvas 2D and WebGL) */
  enableDualMode?: boolean;
  /** Pixel difference tolerance percentage for compatibility tests */
  toleranceThreshold?: number;
  /** Enable verbose logging for test adapter operations */
  verboseLogging?: boolean;
  /** Take screenshots on test failures for debugging */
  screenshotOnFailure?: boolean;
}

/**
 * Parse test environment variables and return configuration
 */
export function getTestEnvironmentConfig(): TestEnvironmentConfig {
  return {
    forceRenderingMode: parseRenderingMode(process.env.SHIBORI_TEST_RENDERING_MODE),
    enableDualMode: parseBooleanEnv(process.env.SHIBORI_TEST_DUAL_MODE),
    toleranceThreshold: parseNumberEnv(process.env.SHIBORI_TEST_TOLERANCE, 5),
    verboseLogging: parseBooleanEnv(process.env.SHIBORI_TEST_VERBOSE),
    screenshotOnFailure: parseBooleanEnv(process.env.SHIBORI_TEST_SCREENSHOTS, true)
  };
}

/**
 * Parse rendering mode from environment variable
 */
function parseRenderingMode(value?: string): 'canvas2d' | 'webgl' | 'auto' {
  switch (value?.toLowerCase()) {
    case 'canvas2d':
    case '2d':
      return 'canvas2d';
    case 'webgl':
    case 'gl':
      return 'webgl';
    case 'auto':
    default:
      return 'auto';
  }
}

/**
 * Parse boolean environment variable
 */
function parseBooleanEnv(value?: string, defaultValue: boolean = false): boolean {
  if (!value) return defaultValue;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Parse number environment variable
 */
function parseNumberEnv(value?: string, defaultValue: number = 0): number {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Log test environment configuration
 */
export function logTestEnvironment(): void {
  const config = getTestEnvironmentConfig();
  
  console.log('🧪 Shibori Test Environment Configuration:');
  console.log(`   Rendering Mode: ${config.forceRenderingMode}`);
  console.log(`   Dual Mode: ${config.enableDualMode ? '✅' : '❌'}`);
  console.log(`   Tolerance: ${config.toleranceThreshold}%`);
  console.log(`   Verbose Logging: ${config.verboseLogging ? '✅' : '❌'}`);
  console.log(`   Screenshots: ${config.screenshotOnFailure ? '✅' : '❌'}`);
  
  if (config.enableDualMode) {
    console.log('   🔄 Dual-mode testing enabled: Will compare Canvas 2D vs WebGL');
  }
  
  if (config.forceRenderingMode !== 'auto') {
    console.log(`   🔒 Forced rendering mode: ${config.forceRenderingMode}`);
  }
}

/**
 * Check if dual-mode testing should be enabled
 */
export function shouldUseDualMode(): boolean {
  const config = getTestEnvironmentConfig();
  return config.enableDualMode === true;
}

/**
 * Get preferred rendering mode for tests
 */
export function getPreferredRenderingMode(): 'canvas2d' | 'webgl' | 'auto' {
  const config = getTestEnvironmentConfig();
  return config.forceRenderingMode || 'auto';
}

/**
 * Get tolerance threshold for pixel comparisons
 */
export function getToleranceThreshold(): number {
  const config = getTestEnvironmentConfig();
  return config.toleranceThreshold || 5;
}

/**
 * Check if verbose logging is enabled
 */
export function isVerboseLogging(): boolean {
  const config = getTestEnvironmentConfig();
  return config.verboseLogging === true;
}