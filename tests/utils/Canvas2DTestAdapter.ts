import { CanvasTestAdapter, CanvasAnalysis } from './CanvasTestAdapter';

/**
 * Canvas 2D implementation of the CanvasTestAdapter
 * Wraps existing Canvas 2D testing logic for compatibility with the adapter pattern
 */
export class Canvas2DTestAdapter extends CanvasTestAdapter {
  /**
   * Check if this adapter supports the given canvas
   * @param canvas The canvas element to check
   * @returns True if canvas has a 2D context
   */
  supports(canvas: HTMLCanvasElement): boolean {
    try {
      const ctx = canvas.getContext('2d');
      return ctx !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get the rendering context type this adapter handles
   * @returns "2d" for Canvas 2D context
   */
  getContextType(): string {
    return '2d';
  }

  /**
   * Get raw pixel data from Canvas 2D context
   * @param canvas The canvas element to read from
   * @returns Uint8Array of RGBA pixel data
   */
  async getPixelData(canvas: HTMLCanvasElement): Promise<Uint8Array> {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas does not have a 2D context');
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return imageData.data;
  }

  /**
   * Analyze pixel distribution in a Canvas 2D canvas
   * @param canvas The canvas element to analyze
   * @returns Pixel analysis including counts and drawing density
   */
  async analyzePixels(canvas: HTMLCanvasElement): Promise<CanvasAnalysis> {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        pixelCounts: { total: 0, white: 0, navy: 0, other: 0 },
        hasDrawing: false,
        drawingDensity: 0
      };
    }

    const pixelData = await this.getPixelData(canvas);
    return this.calculateAnalysis(pixelData, canvas.width, canvas.height);
  }

  /**
   * Get just the white pixel count (optimized for simple checks)
   * @param canvas The canvas element to analyze
   * @returns Count of white pixels
   */
  async getWhitePixelCount(canvas: HTMLCanvasElement): Promise<number> {
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const pixelData = await this.getPixelData(canvas);
    let count = 0;
    
    for (let i = 0; i < pixelData.length; i += 4) {
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];
      
      if (this.classifyPixel(r, g, b) === 'white') {
        count++;
      }
    }
    
    return count;
  }
}