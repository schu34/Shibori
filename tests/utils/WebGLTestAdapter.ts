import { CanvasTestAdapter, CanvasAnalysis } from './CanvasTestAdapter';

/**
 * WebGL implementation of the CanvasTestAdapter
 * Uses gl.readPixels() for pixel analysis in WebGL contexts
 */
export class WebGLTestAdapter extends CanvasTestAdapter {
  /**
   * Check if this adapter supports the given canvas
   * @param canvas The canvas element to check
   * @returns True if canvas has a WebGL context
   */
  supports(canvas: HTMLCanvasElement): boolean {
    try {
      // Try WebGL2 first, then fallback to WebGL1
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      return gl !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get the rendering context type this adapter handles
   * @returns "webgl" for WebGL context
   */
  getContextType(): string {
    return 'webgl';
  }

  /**
   * Get WebGL context from canvas with preference for WebGL2
   * @param canvas The canvas element
   * @returns WebGL rendering context or null
   */
  private getWebGLContext(canvas: HTMLCanvasElement): WebGLRenderingContext | WebGL2RenderingContext | null {
    // Try WebGL2 first for better performance and features
    const gl2 = canvas.getContext('webgl2');
    if (gl2) return gl2;
    
    // Fallback to WebGL1
    const gl1 = canvas.getContext('webgl');
    if (gl1) return gl1;
    
    return null;
  }

  /**
   * Get raw pixel data from WebGL context using gl.readPixels()
   * @param canvas The canvas element to read from
   * @returns Uint8Array of RGBA pixel data
   */
  async getPixelData(canvas: HTMLCanvasElement): Promise<Uint8Array> {
    const gl = this.getWebGLContext(canvas);
    if (!gl) {
      throw new Error('Canvas does not have a WebGL context');
    }

    // Create pixel buffer
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    
    // Read pixels from the framebuffer
    // Note: WebGL coordinates are bottom-left origin, so we need to handle flipping
    gl.readPixels(
      0, 0,                    // x, y start position
      canvas.width,            // width
      canvas.height,           // height
      gl.RGBA,                 // format
      gl.UNSIGNED_BYTE,        // type
      pixels                   // destination buffer
    );

    // Check for WebGL errors
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
      throw new Error(`WebGL error reading pixels: ${error}`);
    }

    // WebGL uses bottom-left origin, but Canvas 2D uses top-left
    // We need to flip the image vertically for consistency
    return this.flipPixelDataVertically(pixels, canvas.width, canvas.height);
  }

  /**
   * Flip pixel data vertically to match Canvas 2D coordinate system
   * @param pixels RGBA pixel data array
   * @param width Canvas width
   * @param height Canvas height
   * @returns Vertically flipped pixel data
   */
  private flipPixelDataVertically(pixels: Uint8Array, width: number, height: number): Uint8Array {
    const flipped = new Uint8Array(pixels.length);
    const rowSize = width * 4; // 4 bytes per pixel (RGBA)
    
    for (let y = 0; y < height; y++) {
      const sourceRow = (height - 1 - y) * rowSize; // Flip vertically
      const targetRow = y * rowSize;
      
      for (let x = 0; x < rowSize; x++) {
        flipped[targetRow + x] = pixels[sourceRow + x];
      }
    }
    
    return flipped;
  }

  /**
   * Analyze pixel distribution in a WebGL canvas
   * @param canvas The canvas element to analyze
   * @returns Pixel analysis including counts and drawing density
   */
  async analyzePixels(canvas: HTMLCanvasElement): Promise<CanvasAnalysis> {
    const gl = this.getWebGLContext(canvas);
    if (!gl) {
      return {
        pixelCounts: { total: 0, white: 0, navy: 0, other: 0 },
        hasDrawing: false,
        drawingDensity: 0
      };
    }

    try {
      const pixelData = await this.getPixelData(canvas);
      return this.calculateAnalysis(pixelData, canvas.width, canvas.height);
    } catch (error) {
      console.warn('WebGL pixel analysis failed:', error);
      return {
        pixelCounts: { total: 0, white: 0, navy: 0, other: 0 },
        hasDrawing: false,
        drawingDensity: 0
      };
    }
  }

  /**
   * Get just the white pixel count (optimized for simple checks)
   * @param canvas The canvas element to analyze
   * @returns Count of white pixels
   */
  async getWhitePixelCount(canvas: HTMLCanvasElement): Promise<number> {
    const gl = this.getWebGLContext(canvas);
    if (!gl) return 0;

    try {
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
    } catch (error) {
      console.warn('WebGL white pixel count failed:', error);
      return 0;
    }
  }

  /**
   * Check if WebGL is available in the current environment
   * @returns True if WebGL is supported
   */
  static isWebGLAvailable(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      return gl !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get WebGL capabilities and information
   * @param canvas Optional canvas to check specific context
   * @returns WebGL capabilities object
   */
  static getWebGLInfo(canvas?: HTMLCanvasElement): {
    isAvailable: boolean;
    version: string | null;
    renderer: string | null;
    vendor: string | null;
    maxTextureSize: number | null;
  } {
    try {
      const testCanvas = canvas || document.createElement('canvas');
      const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
      
      if (!gl) {
        return {
          isAvailable: false,
          version: null,
          renderer: null,
          vendor: null,
          maxTextureSize: null
        };
      }

      return {
        isAvailable: true,
        version: gl.getParameter(gl.VERSION),
        renderer: gl.getParameter(gl.RENDERER),
        vendor: gl.getParameter(gl.VENDOR),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE)
      };
    } catch (error) {
      return {
        isAvailable: false,
        version: null,
        renderer: null,
        vendor: null,
        maxTextureSize: null
      };
    }
  }
}