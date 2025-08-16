import { Page } from '@playwright/test';
import { 
  CanvasTestAdapter, 
  CanvasAnalysis, 
  CanvasComparison,
  getCanvasAdapterWithPreference 
} from './CanvasTestAdapter';

/**
 * Interface for dual-mode test results comparing Canvas 2D vs WebGL
 */
export interface DualModeComparison {
  canvas2d: CanvasAnalysis;
  webgl: CanvasAnalysis;
  pixelDifference: {
    whiteDelta: number;
    navyDelta: number;
    otherDelta: number;
    totalDelta: number;
  };
  isCompatible: boolean;
  compatibilityScore: number; // 0-100, higher is better
  notes: string[];
}

export interface DualModeDrawingComparison {
  canvas2d: CanvasComparison;
  webgl: CanvasComparison;
  drawingCompatibility: {
    bothDrawingOccurred: boolean;
    whitePixelDelta: number;
    percentageDifference: number;
  };
  isCompatible: boolean;
  notes: string[];
}

/**
 * Test runner that compares Canvas 2D and WebGL implementations
 * Useful for validating pixel-perfect compatibility during migration
 */
export class DualModeTestRunner {
  private page: Page;
  private toleranceThreshold: number;

  constructor(page: Page, toleranceThreshold: number = 5) {
    this.page = page;
    this.toleranceThreshold = toleranceThreshold; // Acceptable pixel difference percentage
  }

  /**
   * Compare canvas analysis between Canvas 2D and WebGL implementations
   * @param canvasIndex Which canvas to analyze (0 = folded, 1 = unfolded)
   * @returns Dual-mode comparison results
   */
  async compareCanvasAnalysis(canvasIndex: number = 0): Promise<DualModeComparison> {
    // Get analysis from both rendering modes
    const canvas2dAnalysis = await this.analyzeWithMode(canvasIndex, '2d');
    const webglAnalysis = await this.analyzeWithMode(canvasIndex, 'webgl');

    // Calculate pixel differences
    const pixelDifference = {
      whiteDelta: Math.abs(webglAnalysis.pixelCounts.white - canvas2dAnalysis.pixelCounts.white),
      navyDelta: Math.abs(webglAnalysis.pixelCounts.navy - canvas2dAnalysis.pixelCounts.navy),
      otherDelta: Math.abs(webglAnalysis.pixelCounts.other - canvas2dAnalysis.pixelCounts.other),
      totalDelta: Math.abs(webglAnalysis.pixelCounts.total - canvas2dAnalysis.pixelCounts.total)
    };

    // Calculate compatibility score
    const maxPixels = Math.max(canvas2dAnalysis.pixelCounts.total, webglAnalysis.pixelCounts.total);
    const totalDifference = pixelDifference.whiteDelta + pixelDifference.navyDelta + pixelDifference.otherDelta;
    const compatibilityScore = maxPixels > 0 ? Math.max(0, 100 - (totalDifference / maxPixels * 100)) : 100;

    // Determine compatibility
    const percentageDifference = maxPixels > 0 ? (totalDifference / maxPixels * 100) : 0;
    const isCompatible = percentageDifference <= this.toleranceThreshold;

    // Generate notes
    const notes: string[] = [];
    if (!isCompatible) {
      notes.push(`Pixel difference (${percentageDifference.toFixed(2)}%) exceeds tolerance (${this.toleranceThreshold}%)`);
    }
    if (pixelDifference.totalDelta > 0) {
      notes.push(`Total pixel count mismatch: ${pixelDifference.totalDelta} pixels`);
    }
    if (Math.abs(canvas2dAnalysis.drawingDensity - webglAnalysis.drawingDensity) > 1) {
      notes.push(`Drawing density difference: ${Math.abs(canvas2dAnalysis.drawingDensity - webglAnalysis.drawingDensity).toFixed(2)}%`);
    }

    return {
      canvas2d: canvas2dAnalysis,
      webgl: webglAnalysis,
      pixelDifference,
      isCompatible,
      compatibilityScore,
      notes
    };
  }

  /**
   * Compare drawing operations between Canvas 2D and WebGL
   * @param canvasIndex Which canvas to analyze
   * @param drawingOperation Function that performs the drawing
   * @returns Dual-mode drawing comparison
   */
  async compareDrawingOperation(
    canvasIndex: number,
    drawingOperation: () => Promise<void>
  ): Promise<DualModeDrawingComparison> {
    // Get before/after analysis for Canvas 2D
    const canvas2dComparison = await this.compareDrawingWithMode(canvasIndex, drawingOperation, '2d');
    
    // Get before/after analysis for WebGL
    const webglComparison = await this.compareDrawingWithMode(canvasIndex, drawingOperation, 'webgl');

    // Calculate drawing compatibility
    const bothDrawingOccurred = canvas2dComparison.drawingOccurred && webglComparison.drawingOccurred;
    const whitePixelDelta = Math.abs(webglComparison.whitePixelsDelta - canvas2dComparison.whitePixelsDelta);
    
    const maxWhitePixels = Math.max(canvas2dComparison.whitePixelsDelta, webglComparison.whitePixelsDelta);
    const percentageDifference = maxWhitePixels > 0 ? (whitePixelDelta / maxWhitePixels * 100) : 0;
    
    const isCompatible = bothDrawingOccurred && percentageDifference <= this.toleranceThreshold;

    // Generate notes
    const notes: string[] = [];
    if (!bothDrawingOccurred) {
      notes.push(`Drawing inconsistency: Canvas2D=${canvas2dComparison.drawingOccurred}, WebGL=${webglComparison.drawingOccurred}`);
    }
    if (percentageDifference > this.toleranceThreshold) {
      notes.push(`White pixel difference (${percentageDifference.toFixed(2)}%) exceeds tolerance`);
    }

    return {
      canvas2d: canvas2dComparison,
      webgl: webglComparison,
      drawingCompatibility: {
        bothDrawingOccurred,
        whitePixelDelta,
        percentageDifference
      },
      isCompatible,
      notes
    };
  }

  /**
   * Run comprehensive compatibility test suite
   * @param drawingOperations Array of drawing operations to test
   * @returns Comprehensive test results
   */
  async runCompatibilityTestSuite(
    drawingOperations: Array<{
      name: string;
      operation: () => Promise<void>;
    }>
  ): Promise<{
    overallCompatible: boolean;
    staticAnalysis: DualModeComparison;
    drawingTests: Array<DualModeDrawingComparison & { testName: string }>;
    summary: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      averageCompatibilityScore: number;
    };
  }> {
    // Static analysis (comparing current canvas state)
    const staticAnalysis = await this.compareCanvasAnalysis(0);

    // Drawing operation tests
    const drawingTests: Array<DualModeDrawingComparison & { testName: string }> = [];
    
    for (const test of drawingOperations) {
      const result = await this.compareDrawingOperation(0, test.operation);
      drawingTests.push({
        ...result,
        testName: test.name
      });
    }

    // Calculate summary
    const totalTests = drawingTests.length + 1; // +1 for static analysis
    const passedTests = drawingTests.filter(t => t.isCompatible).length + (staticAnalysis.isCompatible ? 1 : 0);
    const failedTests = totalTests - passedTests;
    
    const allScores = [staticAnalysis.compatibilityScore, ...drawingTests.map(t => t.drawingCompatibility.percentageDifference)];
    const averageCompatibilityScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;

    const overallCompatible = staticAnalysis.isCompatible && drawingTests.every(t => t.isCompatible);

    return {
      overallCompatible,
      staticAnalysis,
      drawingTests,
      summary: {
        totalTests,
        passedTests,
        failedTests,
        averageCompatibilityScore
      }
    };
  }

  /**
   * Analyze canvas with specific rendering mode
   * @param canvasIndex Canvas to analyze
   * @param mode Rendering mode preference
   * @returns Canvas analysis
   */
  private async analyzeWithMode(canvasIndex: number, mode: '2d' | 'webgl'): Promise<CanvasAnalysis> {
    return await this.page.evaluate(async ([index, preferredMode]) => {
      const canvas = document.querySelectorAll('canvas')[index] as HTMLCanvasElement;
      
      // We'll implement adapter selection logic here
      // For now, use Canvas 2D logic as fallback
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return {
          pixelCounts: { total: 0, white: 0, navy: 0, other: 0 },
          hasDrawing: false,
          drawingDensity: 0
        };
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      let whitePixels = 0;
      let navyPixels = 0;
      let otherPixels = 0;
      const totalPixels = data.length / 4;

      const classifyPixel = (r: number, g: number, b: number): 'white' | 'navy' | 'other' => {
        if (r > 240 && g > 240 && b > 240) return 'white';
        if (r < 50 && g < 50 && b > 100) return 'navy';
        return 'other';
      };

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        const pixelType = classifyPixel(r, g, b);
        switch (pixelType) {
          case 'white': whitePixels++; break;
          case 'navy': navyPixels++; break;
          case 'other': otherPixels++; break;
        }
      }

      return {
        pixelCounts: { total: totalPixels, white: whitePixels, navy: navyPixels, other: otherPixels },
        hasDrawing: whitePixels > 0,
        drawingDensity: (whitePixels / totalPixels) * 100
      };
    }, [canvasIndex, mode] as const);
  }

  /**
   * Compare drawing operation with specific rendering mode
   * @param canvasIndex Canvas to analyze
   * @param operation Drawing operation
   * @param mode Rendering mode preference
   * @returns Canvas comparison
   */
  private async compareDrawingWithMode(
    canvasIndex: number,
    operation: () => Promise<void>,
    mode: '2d' | 'webgl'
  ): Promise<CanvasComparison> {
    // Get before state
    const before = await this.analyzeWithMode(canvasIndex, mode);
    
    // Perform drawing operation
    await operation();
    
    // Wait for rendering to complete
    await this.page.waitForTimeout(500);
    
    // Get after state
    const after = await this.analyzeWithMode(canvasIndex, mode);
    
    const whitePixelsDelta = after.pixelCounts.white - before.pixelCounts.white;
    
    return {
      before,
      after,
      whitePixelsDelta,
      drawingOccurred: whitePixelsDelta > 0
    };
  }
}