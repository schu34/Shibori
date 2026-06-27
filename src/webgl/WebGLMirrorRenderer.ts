/**
 * WebGL Mirror Renderer
 * Replaces ImageUtils flip operations with GPU-accelerated shader-based mirroring
 */

import { WebGLRenderer } from './WebGLRenderer';
import { ShaderProgram } from './ShaderProgram';
import { BufferManager } from './BufferManager';
import { getShaderTemplate } from './ShaderTemplates';
import { FoldState } from '../services/CanvasService';

export type MirrorOperation = 
  | 'none'
  | 'horizontal'
  | 'vertical'
  | 'both'
  | 'diagonal-main'     // Top-left to bottom-right
  | 'diagonal-anti';    // Top-right to bottom-left

export interface MirrorConfig {
  /** Source texture to mirror */
  sourceTexture: WebGLTexture;
  /** Mirror operation to perform */
  operation: MirrorOperation;
  /** Mirror origin point (normalized 0-1 coordinates) */
  origin?: { x: number; y: number };
  /** Source texture dimensions */
  sourceWidth: number;
  sourceHeight: number;
  /** Target dimensions (can be different for scaling) */
  targetWidth?: number;
  targetHeight?: number;
  /** Composite the original source sample with the mirrored sample */
  includeOriginal?: boolean;
}

export interface GridMirrorConfig {
  /** Source texture containing the folded pattern */
  sourceTexture: WebGLTexture;
  /** Fold configuration determining mirror pattern */
  folds: FoldState;
  /** Source dimensions */
  sourceWidth: number;
  sourceHeight: number;
  /** Target dimensions for unfolded result */
  targetWidth: number;
  targetHeight: number;
}

/**
 * WebGL-based mirroring system for real-time symmetric pattern generation
 */
export class WebGLMirrorRenderer {
  private renderer: WebGLRenderer;
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private bufferManager: BufferManager;
  private mirrorProgram: ShaderProgram | null = null;
  private copyProgram: ShaderProgram | null = null;
  private quadBuffers: {
    position?: string;
    texCoord?: string;
    index?: string;
  } = {};

  // Framebuffer for render-to-texture operations
  private framebuffer: WebGLFramebuffer | null = null;
  private currentRenderTexture: WebGLTexture | null = null;

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer;
    const gl = renderer.getContext();
    const bufferManager = renderer.getBufferManager();

    if (!gl || !bufferManager) {
      throw new Error('WebGL context or buffer manager not available');
    }

    this.gl = gl;
    this.bufferManager = bufferManager;
    this.initializeShaders();
    this.createQuadGeometry();
    this.setupFramebuffer();
  }

  /**
   * Initialize mirror rendering shaders
   */
  private initializeShaders(): void {
    // Mirror shader for flip operations
    const mirrorTemplate = getShaderTemplate('mirror');
    this.mirrorProgram = this.renderer.addShaderProgram(
      'mirror',
      mirrorTemplate.vertex,
      mirrorTemplate.fragment
    );

    // Copy shader for simple texture copying
    const copyTemplate = getShaderTemplate('copy');
    this.copyProgram = this.renderer.addShaderProgram(
      'copy',
      copyTemplate.vertex,
      copyTemplate.fragment
    );
  }

  /**
   * Create quad geometry for fullscreen rendering
   */
  private createQuadGeometry(): void {
    const quadGeometry = this.bufferManager.createQuadGeometry(2, 2, 0, 0);
    this.quadBuffers = this.bufferManager.createGeometryBuffers(quadGeometry, 'mirror_quad');
  }

  /**
   * Set up framebuffer for render-to-texture operations
   */
  private setupFramebuffer(): void {
    this.framebuffer = this.gl.createFramebuffer();
    if (!this.framebuffer) {
      throw new Error('Failed to create framebuffer');
    }
  }

  /**
   * Create a texture for render-to-texture operations
   */
  private createRenderTexture(width: number, height: number): WebGLTexture {
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create render texture');
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0,
      this.gl.RGBA, this.gl.UNSIGNED_BYTE, null
    );

    // Set texture parameters for render target
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    return texture;
  }

  /**
   * Bind framebuffer for render-to-texture
   */
  private bindFramebuffer(texture: WebGLTexture, width: number, height: number): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D, texture, 0
    );

    // Check framebuffer completeness
    if (this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) !== this.gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Framebuffer is not complete');
    }

    this.gl.viewport(0, 0, width, height);
  }

  /**
   * Unbind framebuffer (render to main canvas)
   */
  private unbindFramebuffer(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    const canvasDims = this.renderer.getCanvasDimensions();
    this.gl.viewport(0, 0, canvasDims.width, canvasDims.height);
  }

  /**
   * Perform a single mirror operation
   */
  public mirror(config: MirrorConfig): WebGLTexture {
    if (!this.mirrorProgram) {
      throw new Error('Mirror shader program not initialized');
    }

    const targetWidth = config.targetWidth || config.sourceWidth;
    const targetHeight = config.targetHeight || config.sourceHeight;
    
    // Create render target texture
    const renderTexture = this.createRenderTexture(targetWidth, targetHeight);
    
    // Bind framebuffer for render-to-texture
    this.bindFramebuffer(renderTexture, targetWidth, targetHeight);

    // Use mirror shader
    this.mirrorProgram.use();

    // Set uniforms
    this.mirrorProgram.setUniform('u_resolution', [targetWidth, targetHeight]);
    this.mirrorProgram.setUniformInt('u_mirrorMode', this.getMirrorModeValue(config.operation));
    this.mirrorProgram.setUniform('u_mirrorOrigin', [
      config.origin?.x || 0.5,
      config.origin?.y || 0.5
    ]);
    this.mirrorProgram.setUniformInt('u_includeOriginal', config.includeOriginal ? 1 : 0);

    // Bind source texture
    this.mirrorProgram.setTexture('u_sourceTexture', config.sourceTexture, 0);

    // Set up vertex attributes
    this.setupQuadAttributes(this.mirrorProgram);

    // Render
    this.renderQuad();

    // Clean up
    this.cleanupQuadAttributes(this.mirrorProgram);
    this.unbindFramebuffer();

    return renderTexture;
  }

  /**
   * Convert mirror operation to shader uniform value
   */
  private getMirrorModeValue(operation: MirrorOperation): number {
    switch (operation) {
      case 'none': return 0;
      case 'horizontal': return 1;
      case 'vertical': return 2;
      case 'both': return 3;
      case 'diagonal-main': return 4;
      case 'diagonal-anti': return 5;
      default: return 0;
    }
  }

  /**
   * Generate the complete unfolded pattern from folded source
   */
  public generateUnfoldedPattern(config: GridMirrorConfig): WebGLTexture {
    const { folds, sourceWidth, sourceHeight, targetWidth, targetHeight } = config;

    // Calculate grid dimensions
    const gridWidth = Math.pow(2, folds.vertical);
    const gridHeight = Math.pow(2, folds.horizontal);

    // Create render target for final result
    const finalTexture = this.createRenderTexture(targetWidth, targetHeight);
    
    // Calculate cell dimensions
    const cellWidth = targetWidth / gridWidth;
    const cellHeight = targetHeight / gridHeight;

    // Apply diagonal mirroring first if needed
    let workingTexture = config.sourceTexture;
    if (folds.diagonal.enabled && folds.diagonal.count === 1) {
      const diagonalOp = folds.diagonal.direction === 'topRightToBottomLeft' 
        ? 'diagonal-anti' 
        : 'diagonal-main';
      
      workingTexture = this.mirror({
        sourceTexture: config.sourceTexture,
        operation: diagonalOp,
        sourceWidth,
        sourceHeight,
        targetWidth: cellWidth,
        targetHeight: cellHeight,
        includeOriginal: true
      });
    }

    // Create intermediate textures for different mirror variations
    const horizontalFlipped = this.mirror({
      sourceTexture: workingTexture,
      operation: 'horizontal',
      sourceWidth: cellWidth,
      sourceHeight: cellHeight
    });

    const verticalFlipped = this.mirror({
      sourceTexture: workingTexture,
      operation: 'vertical',
      sourceWidth: cellWidth,
      sourceHeight: cellHeight
    });

    const bothFlipped = this.mirror({
      sourceTexture: workingTexture,
      operation: 'both',
      sourceWidth: cellWidth,
      sourceHeight: cellHeight
    });

    // Bind framebuffer for final composition
    this.bindFramebuffer(finalTexture, targetWidth, targetHeight);

    // Clear to background color (navy)
    this.gl.clearColor(0.0, 0.0, 0.5, 1.0); // Navy background
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // Render each cell of the grid
    for (let row = 0; row < gridHeight; row++) {
      for (let col = 0; col < gridWidth; col++) {
        // Determine which pattern to use based on grid position
        let textureToUse: WebGLTexture;
        const isRowEven = row % 2 === 0;
        const isColEven = col % 2 === 0;

        if (isRowEven && isColEven) {
          textureToUse = workingTexture;
        } else if (isRowEven && !isColEven) {
          textureToUse = horizontalFlipped;
        } else if (!isRowEven && isColEven) {
          textureToUse = verticalFlipped;
        } else {
          textureToUse = bothFlipped;
        }

        // Calculate position and size for this cell
        const x = col * cellWidth;
        const y = row * cellHeight;

        // Render this cell
        this.renderTextureToRegion(
          textureToUse,
          x, y, cellWidth, cellHeight,
          targetWidth, targetHeight
        );
      }
    }

    // Clean up intermediate textures
    if (workingTexture !== config.sourceTexture) {
      this.gl.deleteTexture(workingTexture);
    }
    this.gl.deleteTexture(horizontalFlipped);
    this.gl.deleteTexture(verticalFlipped);
    this.gl.deleteTexture(bothFlipped);

    this.unbindFramebuffer();
    return finalTexture;
  }

  /**
   * Render a texture to a specific region of the current framebuffer
   */
  private renderTextureToRegion(
    texture: WebGLTexture,
    x: number, y: number, width: number, height: number,
    _canvasWidth: number, canvasHeight: number
  ): void {
    if (!this.copyProgram) return;

    // Set viewport for this region
    this.gl.viewport(x, canvasHeight - y - height, width, height); // Flip Y for WebGL

    this.copyProgram.use();
    this.copyProgram.setUniform('u_opacity', 1.0);
    this.copyProgram.setTexture('u_texture', texture, 0);

    this.setupQuadAttributes(this.copyProgram);
    this.renderQuad();
    this.cleanupQuadAttributes(this.copyProgram);
  }

  /**
   * Set up vertex attributes for quad rendering
   */
  private setupQuadAttributes(program: ShaderProgram): void {
    // Position attribute
    if (this.quadBuffers.position) {
      this.bufferManager.bindBuffer(this.quadBuffers.position);
      program.enableAttribute('a_position');
      program.setAttributePointer('a_position', 3);
    }

    // Texture coordinate attribute
    if (this.quadBuffers.texCoord) {
      this.bufferManager.bindBuffer(this.quadBuffers.texCoord);
      program.enableAttribute('a_texCoord');
      program.setAttributePointer('a_texCoord', 2);
    }
  }

  /**
   * Clean up vertex attributes after rendering
   */
  private cleanupQuadAttributes(program: ShaderProgram): void {
    program.disableAttribute('a_position');
    program.disableAttribute('a_texCoord');
  }

  /**
   * Render the quad geometry
   */
  private renderQuad(): void {
    if (this.quadBuffers.index) {
      const indexBuffer = this.bufferManager.getBufferInfo(this.quadBuffers.index);
      if (indexBuffer) {
        this.bufferManager.bindBuffer(this.quadBuffers.index);
        const indexCount = indexBuffer.size / 2; // Uint16Array
        this.gl.drawElements(this.gl.TRIANGLES, indexCount, this.gl.UNSIGNED_SHORT, 0);
      }
    }
  }

  /**
   * Create a texture from Canvas 2D ImageData
   */
  public createTextureFromImageData(imageData: ImageData): WebGLTexture {
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create texture');
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D, 0, this.gl.RGBA,
      imageData.width, imageData.height, 0,
      this.gl.RGBA, this.gl.UNSIGNED_BYTE, imageData.data
    );

    // Set texture parameters
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    return texture;
  }

  /**
   * Create a texture from a canvas element
   */
  public createTextureFromCanvas(canvas: HTMLCanvasElement): WebGLTexture {
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create texture');
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, canvas
    );

    // Set texture parameters
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    return texture;
  }

  /**
   * Render a texture to the main canvas
   */
  public renderToCanvas(texture: WebGLTexture): void {
    if (!this.copyProgram) return;

    this.unbindFramebuffer(); // Ensure we're rendering to main canvas
    
    this.copyProgram.use();
    this.copyProgram.setUniform('u_opacity', 1.0);
    this.copyProgram.setTexture('u_texture', texture, 0);

    this.setupQuadAttributes(this.copyProgram);
    this.renderQuad();
    this.cleanupQuadAttributes(this.copyProgram);
  }

  /**
   * Read pixels from a texture (for debugging or Canvas 2D integration)
   */
  public readPixelsFromTexture(texture: WebGLTexture, width: number, height: number): Uint8Array {
    // Bind texture to framebuffer
    this.bindFramebuffer(texture, width, height);

    // Read pixels
    const pixels = new Uint8Array(width * height * 4);
    this.gl.readPixels(0, 0, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);

    this.unbindFramebuffer();
    return pixels;
  }

  /**
   * Convert WebGL texture to ImageData for Canvas 2D integration
   */
  public textureToImageData(texture: WebGLTexture, width: number, height: number): ImageData {
    const pixels = this.readPixelsFromTexture(texture, width, height);
    
    // WebGL Y-axis is flipped compared to Canvas 2D, so we need to flip the image
    const flippedPixels = new Uint8ClampedArray(pixels.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIndex = ((height - 1 - y) * width + x) * 4;
        const dstIndex = (y * width + x) * 4;
        flippedPixels[dstIndex] = pixels[srcIndex];
        flippedPixels[dstIndex + 1] = pixels[srcIndex + 1];
        flippedPixels[dstIndex + 2] = pixels[srcIndex + 2];
        flippedPixels[dstIndex + 3] = pixels[srcIndex + 3];
      }
    }

    return new ImageData(flippedPixels, width, height);
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    // Clean up quad buffers
    for (const bufferId of Object.values(this.quadBuffers)) {
      if (bufferId && this.bufferManager.hasBuffer(bufferId)) {
        this.bufferManager.deleteBuffer(bufferId);
      }
    }

    // Clean up framebuffer
    if (this.framebuffer) {
      this.gl.deleteFramebuffer(this.framebuffer);
      this.framebuffer = null;
    }

    // Clean up current render texture
    if (this.currentRenderTexture) {
      this.gl.deleteTexture(this.currentRenderTexture);
      this.currentRenderTexture = null;
    }

    this.quadBuffers = {};
  }
}
