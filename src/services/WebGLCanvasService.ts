/**
 * WebGL Canvas Service
 * Replaces Canvas 2D-based mirroring with GPU-accelerated WebGL operations
 */

import { WebGLRenderer } from '../webgl/WebGLRenderer';
import { WebGLMirrorRenderer, GridMirrorConfig } from '../webgl/WebGLMirrorRenderer';
import { WebGLCapabilities } from '../webgl/WebGLCapabilities';
import { FoldState, CanvasContext } from './CanvasService';
import { logger } from '../utils/logger';

export interface WebGLCanvasContext extends CanvasContext {
  /** WebGL renderer for the unfolded canvas */
  webglRenderer?: WebGLRenderer;
  /** Mirror renderer instance */
  mirrorRenderer?: WebGLMirrorRenderer;
}

/**
 * WebGL-powered canvas service for real-time symmetric pattern generation
 */
export class WebGLCanvasService {
  private static webglRenderer: WebGLRenderer | null = null;
  private static mirrorRenderer: WebGLMirrorRenderer | null = null;
  private static webglCanvas: HTMLCanvasElement | null = null;
  private static isWebGLSupported = WebGLCapabilities.isWebGLSupported();
  private static initializationFailed = false;

  /**
   * Initialize WebGL renderer if not already done
   */
  private static initializeWebGL(targetCanvas: HTMLCanvasElement): boolean {
    if (this.webglRenderer && this.mirrorRenderer && this.webglCanvas) {
      return true;
    }

    if (!this.isWebGLSupported) {
      logger.error('WebGL not supported, falling back to Canvas 2D');
      return false;
    }

    try {
      // Create a separate WebGL canvas to avoid context conflicts
      this.webglCanvas = document.createElement('canvas');
      this.webglCanvas.width = targetCanvas.width;
      this.webglCanvas.height = targetCanvas.height;
      
      // Make it invisible but readable for drawImage - avoid visibility:hidden
      this.webglCanvas.style.position = 'absolute';
      this.webglCanvas.style.left = '-9999px';
      this.webglCanvas.style.top = '-9999px';
      this.webglCanvas.style.opacity = '0';
      this.webglCanvas.style.pointerEvents = 'none';
      this.webglCanvas.style.zIndex = '-1';
      document.body.appendChild(this.webglCanvas);

      this.webglRenderer = new WebGLRenderer({
        canvas: this.webglCanvas,
        contextType: 'webgl2',
        debug: false,
        contextAttributes: {
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
          premultipliedAlpha: false  // Fix alpha blending issues
        }
      });

      this.mirrorRenderer = new WebGLMirrorRenderer(this.webglRenderer);

      logger.canvas.operation('WebGL canvas service initialized with separate canvas');
      return true;
    } catch (error) {
      const errorDetails = {
        message: (error as Error).message,
        webglSupported: WebGLCapabilities.isWebGLSupported(),
        webgl2Supported: WebGLCapabilities.isWebGL2Supported(),
        canvasCreated: !!this.webglCanvas,
        canvasDimensions: this.webglCanvas ? { width: this.webglCanvas.width, height: this.webglCanvas.height } : null
      };
      
      console.error('[WebGLCanvasService] Failed to initialize WebGL canvas service:', errorDetails, error);
      logger.error('Failed to initialize WebGL canvas service', error as Error);
      this.initializationFailed = true;
      
      // Clean up on failure
      if (this.webglCanvas && this.webglCanvas.parentNode) {
        this.webglCanvas.parentNode.removeChild(this.webglCanvas);
        this.webglCanvas = null;
      }
      
      return false;
    }
  }

  /**
   * Update the unfolded canvas using WebGL mirroring
   */
  static updateUnfoldedCanvasWebGL(
    context: WebGLCanvasContext, 
    folds: FoldState
  ): boolean {
    logger.canvas.render('updateUnfoldedCanvasWebGL started');

    const { foldedCanvas, unfoldedCanvas, unfoldedCtx } = context;

    // Initialize WebGL if needed
    if (!this.initializeWebGL(unfoldedCanvas)) {
      return false; // Fallback to Canvas 2D
    }

    if (!this.webglRenderer || !this.mirrorRenderer || !this.webglCanvas) {
      return false;
    }

    try {
      // Ensure WebGL canvas dimensions match target canvas
      if (this.webglCanvas.width !== unfoldedCanvas.width || 
          this.webglCanvas.height !== unfoldedCanvas.height) {
        this.webglCanvas.width = unfoldedCanvas.width;
        this.webglCanvas.height = unfoldedCanvas.height;
        this.webglRenderer.resize(unfoldedCanvas.width, unfoldedCanvas.height);
      }

      // Clear the WebGL canvas with navy background
      this.webglRenderer.setClearColor([0.0, 0.0, 0.5, 1.0]); // Navy
      this.webglRenderer.clear();

      // Create texture from folded canvas
      const sourceTexture = this.mirrorRenderer.createTextureFromCanvas(foldedCanvas);

      // Calculate target dimensions
      const targetWidth = unfoldedCanvas.width;
      const targetHeight = unfoldedCanvas.height;

      // Generate the complete unfolded pattern using WebGL mirroring
      const config: GridMirrorConfig = {
        sourceTexture,
        folds,
        sourceWidth: foldedCanvas.width,
        sourceHeight: foldedCanvas.height,
        targetWidth,
        targetHeight
      };
      
      let unfoldedTexture: WebGLTexture;
      try {
        unfoldedTexture = this.mirrorRenderer.generateUnfoldedPattern(config);
      } catch (error) {
        logger.error('Failed to generate WebGL unfolded pattern', error as Error);
        const gl = this.webglRenderer.getContext();
        if (gl) {
          gl.deleteTexture(sourceTexture);
        }
        return false;
      }

      // Render the result to the WebGL canvas
      this.mirrorRenderer.renderToCanvas(unfoldedTexture);

      // Copy WebGL result to the target Canvas 2D context
      logger.canvas.render('Copying WebGL result to Canvas 2D', {
        webglCanvasSize: { width: this.webglCanvas.width, height: this.webglCanvas.height },
        targetCanvasSize: { width: unfoldedCanvas.width, height: unfoldedCanvas.height }
      });

      this.copyWebGLToCanvas2D(this.webglCanvas, unfoldedCanvas, unfoldedCtx);

      // Draw fold lines on top using Canvas 2D
      this.drawFoldLinesCanvas2D(context, folds);

      // Clean up textures
      const gl = this.webglRenderer.getContext();
      if (gl) {
        gl.deleteTexture(sourceTexture);
        gl.deleteTexture(unfoldedTexture);
      }

      logger.canvas.render('updateUnfoldedCanvasWebGL completed successfully');
      return true;

    } catch (error) {
      logger.error('WebGL unfolded canvas update failed', error as Error);
      return false;
    }
  }

  /**
   * Copy WebGL canvas content to Canvas 2D context
   */
  private static copyWebGLToCanvas2D(
    webglCanvas: HTMLCanvasElement,
    targetCanvas: HTMLCanvasElement,
    ctx2d: CanvasRenderingContext2D
  ): void {
    // Clear the 2D canvas first
    ctx2d.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx2d.drawImage(webglCanvas, 0, 0);
  }

  /**
   * Draw fold lines using Canvas 2D (for compatibility)
   */
  private static drawFoldLinesCanvas2D(
    context: CanvasContext,
    folds: FoldState
  ): void {
    const { unfoldedCtx, unfoldedCanvas } = context;
    const width = unfoldedCanvas.width;
    const height = unfoldedCanvas.height;

    unfoldedCtx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    unfoldedCtx.lineWidth = 2;

    // Draw vertical fold lines
    for (let i = 1; i <= folds.vertical; i++) {
      const segments = Math.pow(2, i);
      for (let j = 1; j < segments; j++) {
        const x = (width / segments) * j;
        unfoldedCtx.beginPath();
        unfoldedCtx.moveTo(x, 0);
        unfoldedCtx.lineTo(x, height);
        unfoldedCtx.stroke();
      }
    }

    // Draw horizontal fold lines
    for (let i = 1; i <= folds.horizontal; i++) {
      const segments = Math.pow(2, i);
      for (let j = 1; j < segments; j++) {
        const y = (height / segments) * j;
        unfoldedCtx.beginPath();
        unfoldedCtx.moveTo(0, y);
        unfoldedCtx.lineTo(width, y);
        unfoldedCtx.stroke();
      }
    }

    // Draw diagonal fold lines if enabled
    if (folds.diagonal.enabled && folds.diagonal.count === 1 && folds.vertical === folds.horizontal) {
      unfoldedCtx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      unfoldedCtx.lineWidth = 2;
      unfoldedCtx.setLineDash([5, 3]);

      unfoldedCtx.beginPath();
      if (folds.diagonal.direction === 'topRightToBottomLeft') {
        unfoldedCtx.moveTo(width, 0);
        unfoldedCtx.lineTo(0, height);
      } else {
        unfoldedCtx.moveTo(0, 0);
        unfoldedCtx.lineTo(width, height);
      }
      unfoldedCtx.stroke();
      unfoldedCtx.setLineDash([]);
    }
  }

  /**
   * Create individual mirror operations for testing/debugging
   */
  static createMirroredTexture(
    sourceCanvas: HTMLCanvasElement,
    operation: 'horizontal' | 'vertical' | 'both' | 'diagonal-main' | 'diagonal-anti'
  ): WebGLTexture | null {
    if (!this.mirrorRenderer) {
      return null;
    }

    const sourceTexture = this.mirrorRenderer.createTextureFromCanvas(sourceCanvas);
    
    const mirroredTexture = this.mirrorRenderer.mirror({
      sourceTexture,
      operation,
      sourceWidth: sourceCanvas.width,
      sourceHeight: sourceCanvas.height
    });

    // Clean up source texture
    const gl = this.webglRenderer?.getContext();
    if (gl) {
      gl.deleteTexture(sourceTexture);
    }

    return mirroredTexture;
  }

  /**
   * Convert WebGL texture back to ImageData for Canvas 2D integration
   */
  static textureToImageData(
    texture: WebGLTexture,
    width: number,
    height: number
  ): ImageData | null {
    if (!this.mirrorRenderer) {
      return null;
    }

    return this.mirrorRenderer.textureToImageData(texture, width, height);
  }

  /**
   * Check if WebGL is supported by the browser
   */
  static isWebGLAvailable(): boolean {
    return this.isWebGLSupported;
  }

  /**
   * Check if WebGL initialization has failed
   */
  static hasWebGLInitializationFailed(): boolean {
    return this.initializationFailed;
  }

  /**
   * Check if WebGL service is fully initialized
   */
  static isWebGLInitialized(): boolean {
    return this.isWebGLSupported && this.webglRenderer !== null && this.mirrorRenderer !== null;
  }

  /**
   * Get WebGL capabilities info for debugging
   */
  static getWebGLInfo(): string | null {
    if (!this.webglRenderer) {
      return null;
    }

    const capabilities = this.webglRenderer.getCapabilities();
    if (!capabilities) {
      return null;
    }

    return `WebGL ${this.webglRenderer.isUsingWebGL2() ? '2' : '1'} - ${capabilities.renderer}`;
  }

  /**
   * Force use of WebGL for unfolded canvas operations
   */
  static forceWebGLMode(enabled: boolean): void {
    // Reset initialization failure state when forcing WebGL mode
    this.initializationFailed = false;
    
    if (!enabled && this.webglRenderer) {
      this.dispose();
    }

    logger.canvas.operation('WebGL mode', { enabled, supported: this.isWebGLSupported });
  }

  /**
   * Get performance comparison between Canvas 2D and WebGL
   */
  static async benchmarkMirrorOperations(
    canvas: HTMLCanvasElement,
    folds: FoldState,
    iterations: number = 10
  ): Promise<{
    webgl: number;
    canvas2d: number;
    speedup: number;
  }> {
    const results = {
      webgl: 0,
      canvas2d: 0,
      speedup: 0
    };

    if (!this.isWebGLInitialized()) {
      logger.error('WebGL not initialized for benchmarking');
      return results;
    }

    // Benchmark WebGL
    const webglStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const context = {
        foldedCanvas: canvas,
        unfoldedCanvas: canvas,
        foldedCtx: canvas.getContext('2d')!,
        unfoldedCtx: canvas.getContext('2d')!
      };
      this.updateUnfoldedCanvasWebGL(context, folds);
    }
    const webglEnd = performance.now();
    results.webgl = webglEnd - webglStart;

    // Note: Canvas 2D benchmarking would require importing the original CanvasService
    // This is left as a placeholder for future implementation

    results.speedup = results.canvas2d > 0 ? results.canvas2d / results.webgl : 0;

    logger.canvas.operation('Mirror benchmark completed', results);
    return results;
  }

  /**
   * Dispose of WebGL resources
   */
  static dispose(): void {
    if (this.mirrorRenderer) {
      this.mirrorRenderer.dispose();
      this.mirrorRenderer = null;
    }

    if (this.webglRenderer) {
      this.webglRenderer.dispose();
      this.webglRenderer = null;
    }

    // Remove the hidden WebGL canvas from DOM
    if (this.webglCanvas && this.webglCanvas.parentNode) {
      this.webglCanvas.parentNode.removeChild(this.webglCanvas);
      this.webglCanvas = null;
    }

    // Reset initialization failure state on disposal
    this.initializationFailed = false;

    logger.canvas.operation('WebGL canvas service disposed');
  }

  /**
   * Get memory usage statistics
   */
  static getMemoryUsage(): {
    buffers: any;
    webglInfo: string | null;
  } | null {
    if (!this.webglRenderer) {
      return null;
    }

    const bufferManager = this.webglRenderer.getBufferManager();
    return {
      buffers: bufferManager?.getMemoryUsage() || null,
      webglInfo: this.getWebGLInfo()
    };
  }
}
