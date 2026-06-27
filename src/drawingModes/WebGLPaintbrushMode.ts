/**
 * WebGL-based Paintbrush Drawing Mode
 * Replaces Canvas 2D paintbrush with GPU-accelerated WebGL rendering
 */

import { DrawingMode, Point, DrawingModeContext, UndoableHistoryItem } from '../types/DrawingMode';
import { ActionType } from '../store/shiboriCanvasState';
import { DrawingTool } from '../types';
import { WebGLRenderer } from '../webgl/WebGLRenderer';
import { WebGLStrokeRenderer, StrokeConfig, StrokePoint } from '../webgl/WebGLStrokeRenderer';
import { WebGLCapabilities } from '../webgl/WebGLCapabilities';
import { PaintbrushMode } from './PaintbrushMode';

export interface WebGLPaintbrushContext extends DrawingModeContext {
  /** WebGL renderer instance */
  webglRenderer?: WebGLRenderer;
  /** Canvas element for WebGL rendering */
  webglCanvas?: HTMLCanvasElement;
  /** Folded canvas element */
  foldedCanvas?: HTMLCanvasElement;
}

/**
 * WebGL-powered paintbrush mode with smooth, pressure-sensitive strokes
 */
export class WebGLPaintbrushMode implements DrawingMode {
  private webglRenderer: WebGLRenderer | null = null;
  private strokeRenderer: WebGLStrokeRenderer | null = null;
  private webglCanvas: HTMLCanvasElement | null = null;
  private isWebGLSupported: boolean = false;
  private currentStrokePoints: StrokePoint[] = [];
  private canvasCopy: ImageData | null = null;
  private fallbackMode: PaintbrushMode | null = null;
  private usingFallback: boolean = false;

  constructor() {
    this.isWebGLSupported = WebGLCapabilities.isWebGLSupported();
    this.fallbackMode = new PaintbrushMode();
  }

  /**
   * Initialize WebGL renderer if not already done
   */
  private initializeWebGL(foldedCanvas: HTMLCanvasElement): boolean {
    if (this.webglRenderer && this.strokeRenderer) {
      const dimensions = this.webglRenderer.getCanvasDimensions();
      if (dimensions.width !== foldedCanvas.width || dimensions.height !== foldedCanvas.height) {
        this.webglRenderer.resize(foldedCanvas.width, foldedCanvas.height);
      }
      return true;
    }

    if (!this.isWebGLSupported) {
      console.warn('[WebGLPaintbrushMode] WebGL not supported, falling back to Canvas 2D');
      return false;
    }

    try {
      this.webglCanvas = document.createElement('canvas');
      this.webglCanvas.width = foldedCanvas.width;
      this.webglCanvas.height = foldedCanvas.height;
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
          preserveDrawingBuffer: true
        }
      });
      this.webglRenderer.setClearColor([0, 0, 0, 0]);

      this.strokeRenderer = new WebGLStrokeRenderer(this.webglRenderer);

      console.log('[WebGLPaintbrushMode] WebGL renderer initialized successfully');
      return true;
    } catch (error) {
      console.error('[WebGLPaintbrushMode] Failed to initialize WebGL:', error);
      this.removeWebGLCanvas();
      // Don't modify isWebGLSupported - browser support hasn't changed
      return false;
    }
  }

  private removeWebGLCanvas(): void {
    if (this.webglCanvas?.parentNode) {
      this.webglCanvas.parentNode.removeChild(this.webglCanvas);
    }
    this.webglCanvas = null;
  }

  /**
   * Create stroke configuration from current drawing state
   */
  private createStrokeConfig(context: DrawingModeContext): StrokeConfig {
    const { getState } = context;
    const { lineThickness, config } = getState();

    // Parse color from CSS color string to WebGL color
    const color = WebGLStrokeRenderer.parseColor(config.lineColor);

    return {
      thickness: lineThickness * 2, // Match perfect-freehand scaling
      color,
      pressureSensitivity: 0.5, // Default pressure sensitivity
      smoothing: 0.5, // Default smoothing
      thinning: 0.5, // Default thinning
      opacity: 1.0 // Full opacity
    };
  }

  /**
   * Convert Point to StrokePoint with pressure information
   */
  private pointToStrokePoint(point: Point, pressure: number = 0.5): StrokePoint {
    return {
      x: point.x,
      y: point.y,
      pressure,
      timestamp: Date.now()
    };
  }

  /**
   * Store current canvas state for preview functionality
   */
  private storeCanvasState(context: DrawingModeContext): void {
    const { foldedCtx, getFoldedCanvasDimensions } = context;
    
    if (foldedCtx) {
      const dimensions = getFoldedCanvasDimensions();
      if (dimensions) {
        this.canvasCopy = foldedCtx.getImageData(0, 0, dimensions.width, dimensions.height);
      }
    }
  }

  /**
   * Restore canvas state from stored copy
   */
  private restoreCanvasState(context: DrawingModeContext): void {
    const { foldedCtx } = context;
    
    if (foldedCtx && this.canvasCopy) {
      foldedCtx.putImageData(this.canvasCopy, 0, 0);
    }
  }

  start(point: Point, context: WebGLPaintbrushContext): void {
    const { foldedCanvas } = context;

    // Try to initialize WebGL if we have a canvas and it's supported
    this.usingFallback = false;
    
    if (foldedCanvas && this.isWebGLSupported) {
      const webglInitialized = this.initializeWebGL(foldedCanvas);
      if (!webglInitialized) {
        this.usingFallback = true;
        console.warn('[WebGLPaintbrushMode] WebGL initialization failed, falling back to Canvas 2D');
      }
    } else {
      this.usingFallback = true;
      console.log('[WebGLPaintbrushMode] Using Canvas 2D fallback mode');
    }

    if (this.usingFallback && this.fallbackMode) {
      // Delegate to Canvas 2D paintbrush mode
      this.fallbackMode.start(point, context);
      return;
    }

    // Store current canvas state for WebGL preview
    this.storeCanvasState(context);

    const { dispatch } = context;
    dispatch({ type: ActionType.SET_IS_DRAWING, payload: true });
    dispatch({ type: ActionType.CLEAR_STROKE_POINTS });
    dispatch({ type: ActionType.ADD_STROKE_POINT, payload: point });

    // Start WebGL stroke if available
    if (this.strokeRenderer) {
      const strokeConfig = this.createStrokeConfig(context);
      const strokePoint = this.pointToStrokePoint(point);
      this.strokeRenderer.startStroke(strokePoint, strokeConfig);
      this.currentStrokePoints = [strokePoint];
    }
  }

  continue(point: Point, context: WebGLPaintbrushContext): boolean {
    // Use fallback mode if WebGL is not available
    if (this.usingFallback && this.fallbackMode) {
      return this.fallbackMode.continue(point, context);
    }

    const { getState, dispatch, isInValidDrawingArea, drawDiagonalFoldLinesOnFolded } = context;

    const { isDrawing } = getState();
    if (!isDrawing) return false;
    if (!isInValidDrawingArea(point.x, point.y)) return false;

    dispatch({ type: ActionType.ADD_STROKE_POINT, payload: point });

    // Handle WebGL rendering
    if (this.strokeRenderer && this.webglRenderer) {
      const strokeConfig = this.createStrokeConfig(context);
      const strokePoint = this.pointToStrokePoint(point);
      
      // Add point to WebGL stroke
      this.strokeRenderer.addStrokePoint(strokePoint, strokeConfig);
      this.currentStrokePoints.push(strokePoint);

      // Clear and render
      this.webglRenderer.clear();
      this.strokeRenderer.renderStroke(strokeConfig);

      // Copy WebGL result to Canvas 2D context for integration with existing system
      this.copyWebGLToCanvas2D(context);

      drawDiagonalFoldLinesOnFolded();
      return true;
    }

    // This shouldn't happen if fallback logic is working correctly
    console.warn('[WebGLPaintbrushMode] WebGL not available and fallback not used');
    return false;
  }

  /**
   * Copy WebGL rendered content to Canvas 2D context
   */
  private copyWebGLToCanvas2D(context: WebGLPaintbrushContext): void {
    const { foldedCtx, getFoldedCanvasDimensions } = context;
    
    if (!foldedCtx || !this.webglRenderer) return;

    const dimensions = getFoldedCanvasDimensions();
    if (!dimensions) return;

    // Restore original canvas state
    this.restoreCanvasState(context);

    // Get WebGL canvas and draw it onto the 2D canvas
    const webglCanvas = this.webglRenderer.getContext()?.canvas;
    if (webglCanvas) {
      foldedCtx.drawImage(webglCanvas, 0, 0, dimensions.width, dimensions.height);
    }
  }

  end(_point: Point | null, context: WebGLPaintbrushContext): UndoableHistoryItem | null {
    // Use fallback mode if WebGL is not available
    if (this.usingFallback && this.fallbackMode) {
      return this.fallbackMode.end(_point, context);
    }

    const { dispatch, getState } = context;
    const { currentStrokePoints } = getState();

    // Finish WebGL stroke
    if (this.strokeRenderer) {
      const strokeConfig = this.createStrokeConfig(context);
      this.strokeRenderer.finishStroke(strokeConfig);
      
      // Final render
      if (this.webglRenderer) {
        this.webglRenderer.clear();
        this.strokeRenderer.renderStroke(strokeConfig);
        this.copyWebGLToCanvas2D(context);
      }

      // Clear WebGL stroke
      this.strokeRenderer.clearStroke();
    }

    dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
    dispatch({ type: ActionType.CLEAR_STROKE_POINTS });
    
    // Clean up
    this.canvasCopy = null;
    this.currentStrokePoints = [];

    return {
      action: DrawingTool.Paintbrush,
      points: currentStrokePoints,
    };
  }

  cancel(context: WebGLPaintbrushContext): void {
    // Use fallback mode if WebGL is not available
    if (this.usingFallback && this.fallbackMode) {
      this.fallbackMode.cancel(context);
      return;
    }

    const { dispatch } = context;

    // Cancel WebGL stroke
    if (this.strokeRenderer) {
      this.strokeRenderer.clearStroke();
    }

    // Restore original canvas state
    this.restoreCanvasState(context);

    dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
    dispatch({ type: ActionType.CLEAR_STROKE_POINTS });
    
    // Clean up
    this.canvasCopy = null;
    this.currentStrokePoints = [];
  }

  /**
   * Check if WebGL is supported and initialized
   */
  public isWebGLAvailable(): boolean {
    return !this.usingFallback && this.isWebGLSupported && this.webglRenderer !== null && this.strokeRenderer !== null;
  }

  /**
   * Get WebGL capabilities info for debugging
   */
  public getWebGLInfo(): string | null {
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
   * Dispose of WebGL resources
   */
  public dispose(): void {
    if (this.strokeRenderer) {
      this.strokeRenderer.dispose();
      this.strokeRenderer = null;
    }

    if (this.webglRenderer) {
      this.webglRenderer.dispose();
      this.webglRenderer = null;
    }

    this.removeWebGLCanvas();
    this.canvasCopy = null;
    this.currentStrokePoints = [];
  }

  /**
   * Static method to check if WebGL paintbrush should be used
   */
  public static shouldUseWebGL(userPreference: 'auto' | 'webgl' | 'canvas2d' = 'auto'): boolean {
    return WebGLCapabilities.getInstance().shouldUseWebGL(userPreference);
  }
}
