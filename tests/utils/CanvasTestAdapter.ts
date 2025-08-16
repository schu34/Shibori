/**
 * Abstract interface for canvas testing that supports both Canvas 2D and WebGL implementations
 * This allows us to run the same tests against different rendering backends
 */

export interface PixelCounts {
  total: number;
  white: number;
  navy: number;
  other: number;
}

export interface CanvasAnalysis {
  pixelCounts: PixelCounts;
  hasDrawing: boolean;
  drawingDensity: number; // percentage of canvas that has drawing
}

export interface CanvasComparison {
  before: CanvasAnalysis;
  after: CanvasAnalysis;
  whitePixelsDelta: number;
  drawingOccurred: boolean;
}

/**
 * Abstract adapter interface for canvas testing operations
 * Implementations will handle Canvas 2D vs WebGL differences
 */
export abstract class CanvasTestAdapter {
  /**
   * Analyze pixel distribution in a canvas
   * @param canvas The canvas element to analyze
   * @returns Pixel analysis including counts and drawing density
   */
  abstract analyzePixels(canvas: HTMLCanvasElement): Promise<CanvasAnalysis>;

  /**
   * Get raw pixel data from canvas
   * @param canvas The canvas element to read from
   * @returns Uint8Array of RGBA pixel data
   */
  abstract getPixelData(canvas: HTMLCanvasElement): Promise<Uint8Array>;

  /**
   * Get just the white pixel count (optimized for simple checks)
   * @param canvas The canvas element to analyze
   * @returns Count of white pixels
   */
  abstract getWhitePixelCount(canvas: HTMLCanvasElement): Promise<number>;

  /**
   * Check if this adapter supports the given canvas
   * @param canvas The canvas element to check
   * @returns True if this adapter can handle the canvas
   */
  abstract supports(canvas: HTMLCanvasElement): boolean;

  /**
   * Get the rendering context type this adapter handles
   * @returns String identifier for the context type
   */
  abstract getContextType(): string;

  /**
   * Helper method to classify pixel colors consistently across adapters
   * @param r Red component (0-255)
   * @param g Green component (0-255)
   * @param b Blue component (0-255)
   * @returns Color classification
   */
  protected classifyPixel(r: number, g: number, b: number): 'white' | 'navy' | 'other' {
    // Check if pixel is close to white (drawing color)
    if (r > 240 && g > 240 && b > 240) {
      return 'white';
    }
    // Check if pixel is close to navy (background color)
    else if (r < 50 && g < 50 && b > 100) {
      return 'navy';
    }
    // Everything else
    return 'other';
  }

  /**
   * Helper method to calculate canvas analysis from pixel data
   * @param pixelData RGBA pixel data array
   * @param width Canvas width
   * @param height Canvas height
   * @returns Canvas analysis object
   */
  protected calculateAnalysis(pixelData: Uint8Array, width: number, height: number): CanvasAnalysis {
    let whitePixels = 0;
    let navyPixels = 0;
    let otherPixels = 0;
    const totalPixels = (pixelData.length / 4);

    for (let i = 0; i < pixelData.length; i += 4) {
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];
      
      const pixelType = this.classifyPixel(r, g, b);
      switch (pixelType) {
        case 'white':
          whitePixels++;
          break;
        case 'navy':
          navyPixels++;
          break;
        case 'other':
          otherPixels++;
          break;
      }
    }

    const pixelCounts = {
      total: totalPixels,
      white: whitePixels,
      navy: navyPixels,
      other: otherPixels
    };

    return {
      pixelCounts,
      hasDrawing: whitePixels > 0,
      drawingDensity: (whitePixels / totalPixels) * 100
    };
  }
}

/**
 * Factory function to get the appropriate adapter for a canvas
 * @param canvas The canvas element to get an adapter for
 * @returns The appropriate adapter instance
 */
export function getCanvasAdapter(canvas: HTMLCanvasElement): CanvasTestAdapter {
  // Lazy imports to avoid circular dependencies
  const { Canvas2DTestAdapter } = require('./Canvas2DTestAdapter');
  const { WebGLTestAdapter } = require('./WebGLTestAdapter');
  
  // Try WebGL adapter first if canvas has WebGL context
  const webglAdapter = new WebGLTestAdapter();
  if (webglAdapter.supports(canvas)) {
    return webglAdapter;
  }
  
  // Fallback to Canvas 2D adapter
  const canvas2dAdapter = new Canvas2DTestAdapter();
  if (canvas2dAdapter.supports(canvas)) {
    return canvas2dAdapter;
  }
  
  // Default to Canvas 2D adapter if no context is detected
  return canvas2dAdapter;
}

/**
 * Factory function with explicit adapter type preference
 * @param canvas The canvas element to get an adapter for
 * @param preferredType Preferred adapter type ('webgl' or '2d')
 * @returns The appropriate adapter instance
 */
export function getCanvasAdapterWithPreference(
  canvas: HTMLCanvasElement, 
  preferredType: 'webgl' | '2d' = 'webgl'
): CanvasTestAdapter {
  // Lazy imports to avoid circular dependencies
  const { Canvas2DTestAdapter } = require('./Canvas2DTestAdapter');
  const { WebGLTestAdapter } = require('./WebGLTestAdapter');
  
  if (preferredType === 'webgl') {
    const webglAdapter = new WebGLTestAdapter();
    if (webglAdapter.supports(canvas)) {
      return webglAdapter;
    }
  }
  
  // Fallback or explicit Canvas 2D preference
  return new Canvas2DTestAdapter();
}

/**
 * Utility function to compare canvas states before and after an operation
 * @param canvas The canvas to analyze
 * @param operation Function that performs the drawing/modification
 * @returns Comparison object with before/after analysis
 */
export async function compareCanvasBeforeAfter(
  canvas: HTMLCanvasElement,
  operation: () => Promise<void>
): Promise<CanvasComparison> {
  const adapter = getCanvasAdapter(canvas);
  
  // Get before state
  const before = await adapter.analyzePixels(canvas);
  
  // Perform operation
  await operation();
  
  // Small delay to ensure rendering is complete
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Get after state
  const after = await adapter.analyzePixels(canvas);
  
  const whitePixelsDelta = after.pixelCounts.white - before.pixelCounts.white;
  
  return {
    before,
    after,
    whitePixelsDelta,
    drawingOccurred: whitePixelsDelta > 0
  };
}