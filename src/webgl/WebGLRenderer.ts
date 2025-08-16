/**
 * WebGL Renderer for Shibori Canvas Drawing
 * Handles WebGL context management, rendering operations, and fallback logic
 */

import { ShaderProgram } from './ShaderProgram';
import { BufferManager } from './BufferManager';

export interface WebGLRendererOptions {
  /** Canvas element to render to */
  canvas: HTMLCanvasElement;
  /** Preferred WebGL context type */
  contextType?: 'webgl2' | 'webgl';
  /** Enable debug mode with additional logging */
  debug?: boolean;
  /** Custom context attributes */
  contextAttributes?: WebGLContextAttributes;
}

export interface RenderState {
  /** Current viewport dimensions */
  viewport: { x: number; y: number; width: number; height: number };
  /** Clear color for the canvas */
  clearColor: [number, number, number, number];
  /** Whether blending is enabled */
  blendingEnabled: boolean;
}

/**
 * Main WebGL renderer class that manages the WebGL context and rendering operations
 */
export class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private isWebGL2: boolean = false;
  private shaderPrograms: Map<string, ShaderProgram> = new Map();
  private bufferManager: BufferManager | null = null;
  private renderState: RenderState;
  private debug: boolean;
  private contextLost: boolean = false;

  constructor(options: WebGLRendererOptions) {
    this.canvas = options.canvas;
    this.debug = options.debug || false;
    
    // Initialize default render state
    this.renderState = {
      viewport: { x: 0, y: 0, width: options.canvas.width, height: options.canvas.height },
      clearColor: [0, 0, 0, 0], // Transparent
      blendingEnabled: true
    };

    // Initialize WebGL context
    this.initializeContext(options.contextType, options.contextAttributes);
  }

  /**
   * Initialize WebGL context with fallback logic
   */
  private initializeContext(
    preferredType?: 'webgl2' | 'webgl',
    contextAttributes?: WebGLContextAttributes
  ): void {
    const defaultAttributes: WebGLContextAttributes = {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      ...contextAttributes
    };

    // Try WebGL2 first (unless WebGL1 is specifically requested)
    if (preferredType !== 'webgl') {
      this.gl = this.canvas.getContext('webgl2', defaultAttributes) as WebGL2RenderingContext;
      if (this.gl) {
        this.isWebGL2 = true;
        this.log('WebGL2 context initialized successfully');
      }
    }

    // Fallback to WebGL1 if WebGL2 failed or wasn't preferred
    if (!this.gl) {
      this.gl = this.canvas.getContext('webgl', defaultAttributes) || 
                this.canvas.getContext('experimental-webgl', defaultAttributes);
      if (this.gl) {
        this.isWebGL2 = false;
        this.log('WebGL1 context initialized successfully');
      }
    }

    if (!this.gl) {
      throw new Error('WebGL not supported in this browser');
    }

    // Initialize buffer manager
    this.bufferManager = new BufferManager(this.gl, this.debug);

    // Set up context loss handling
    this.setupContextLossHandling();

    // Configure initial WebGL state
    this.configureInitialState();
  }

  /**
   * Set up context loss and restore event handlers
   */
  private setupContextLossHandling(): void {
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.contextLost = true;
      this.log('WebGL context lost');
    });

    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.log('WebGL context restored');
      this.reinitializeAfterContextRestore();
    });
  }

  /**
   * Reinitialize resources after context restore
   */
  private reinitializeAfterContextRestore(): void {
    if (!this.gl) return;

    // Recreate buffer manager
    this.bufferManager = new BufferManager(this.gl, this.debug);

    // Recompile all shader programs
    for (const [name, program] of this.shaderPrograms) {
      try {
        program.recompile();
      } catch (error) {
        console.error(`Failed to recompile shader program "${name}":`, error);
        this.shaderPrograms.delete(name);
      }
    }

    // Reconfigure WebGL state
    this.configureInitialState();
  }

  /**
   * Configure initial WebGL state
   */
  private configureInitialState(): void {
    if (!this.gl) return;

    // Enable blending for transparency
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    // Set viewport
    this.setViewport(this.renderState.viewport);

    // Set clear color
    this.setClearColor(this.renderState.clearColor);
  }

  /**
   * Check if WebGL context is available and ready
   */
  public isReady(): boolean {
    return this.gl !== null && !this.contextLost;
  }

  /**
   * Get the WebGL rendering context
   */
  public getContext(): WebGLRenderingContext | WebGL2RenderingContext | null {
    return this.gl;
  }

  /**
   * Check if using WebGL2
   */
  public isUsingWebGL2(): boolean {
    return this.isWebGL2;
  }

  /**
   * Get or create a shader program
   */
  public getShaderProgram(name: string): ShaderProgram | null {
    return this.shaderPrograms.get(name) || null;
  }

  /**
   * Add a shader program to the renderer
   */
  public addShaderProgram(name: string, vertexSource: string, fragmentSource: string): ShaderProgram {
    if (!this.gl) {
      throw new Error('WebGL context not available');
    }

    const program = new ShaderProgram(this.gl, vertexSource, fragmentSource, this.debug);
    this.shaderPrograms.set(name, program);
    this.log(`Shader program "${name}" added successfully`);
    return program;
  }

  /**
   * Get the buffer manager
   */
  public getBufferManager(): BufferManager | null {
    return this.bufferManager;
  }

  /**
   * Set viewport dimensions
   */
  public setViewport(viewport: { x: number; y: number; width: number; height: number }): void {
    if (!this.gl) return;

    this.renderState.viewport = { ...viewport };
    this.gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
  }

  /**
   * Set clear color
   */
  public setClearColor(color: [number, number, number, number]): void {
    if (!this.gl) return;

    this.renderState.clearColor = [...color];
    this.gl.clearColor(color[0], color[1], color[2], color[3]);
  }

  /**
   * Clear the canvas
   */
  public clear(): void {
    if (!this.gl) return;
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  /**
   * Enable or disable blending
   */
  public setBlending(enabled: boolean): void {
    if (!this.gl) return;

    this.renderState.blendingEnabled = enabled;
    if (enabled) {
      this.gl.enable(this.gl.BLEND);
    } else {
      this.gl.disable(this.gl.BLEND);
    }
  }

  /**
   * Resize the canvas and update viewport
   */
  public resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.setViewport({ x: 0, y: 0, width, height });
  }

  /**
   * Get canvas dimensions
   */
  public getCanvasDimensions(): { width: number; height: number } {
    return {
      width: this.canvas.width,
      height: this.canvas.height
    };
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    // Dispose shader programs
    for (const program of this.shaderPrograms.values()) {
      program.dispose();
    }
    this.shaderPrograms.clear();

    // Dispose buffer manager
    if (this.bufferManager) {
      this.bufferManager.dispose();
      this.bufferManager = null;
    }

    // Clear context reference
    this.gl = null;

    this.log('WebGL renderer disposed');
  }

  /**
   * Debug logging utility
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(`[WebGLRenderer] ${message}`);
    }
  }

  /**
   * Static method to check WebGL support
   */
  public static isWebGLSupported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Static method to check WebGL2 support
   */
  public static isWebGL2Supported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      return gl !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get WebGL capabilities information
   */
  public getCapabilities(): {
    maxTextureSize: number;
    maxViewportDims: [number, number];
    maxVertexAttribs: number;
    maxVaryingVectors: number;
    maxFragmentUniforms: number;
    maxVertexUniforms: number;
    version: string;
    renderer: string;
    vendor: string;
  } | null {
    if (!this.gl) return null;

    return {
      maxTextureSize: this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE),
      maxViewportDims: this.gl.getParameter(this.gl.MAX_VIEWPORT_DIMS),
      maxVertexAttribs: this.gl.getParameter(this.gl.MAX_VERTEX_ATTRIBS),
      maxVaryingVectors: this.gl.getParameter(this.gl.MAX_VARYING_VECTORS),
      maxFragmentUniforms: this.gl.getParameter(this.gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      maxVertexUniforms: this.gl.getParameter(this.gl.MAX_VERTEX_UNIFORM_VECTORS),
      version: this.gl.getParameter(this.gl.VERSION),
      renderer: this.gl.getParameter(this.gl.RENDERER),
      vendor: this.gl.getParameter(this.gl.VENDOR)
    };
  }
}