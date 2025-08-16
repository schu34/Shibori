/**
 * WebGL Infrastructure for Shibori Canvas
 * Exports all WebGL utilities and classes
 */

// Core WebGL classes
export { WebGLRenderer } from './WebGLRenderer';
export type { WebGLRendererOptions, RenderState } from './WebGLRenderer';

export { ShaderProgram } from './ShaderProgram';
export type { ShaderProgramInfo, UniformInfo, AttributeInfo } from './ShaderProgram';

export { BufferManager } from './BufferManager';
export type { BufferConfig, BufferInfo, GeometryData } from './BufferManager';

// Shader templates and utilities
export {
  SHADER_TEMPLATES,
  getShaderTemplate,
  validateShaderSource,
  upgradeShaderToGLSL3,
  BASIC_VERTEX_SHADER,
  BASIC_FRAGMENT_SHADER,
  BRUSH_VERTEX_SHADER,
  BRUSH_FRAGMENT_SHADER,
  MIRROR_FRAGMENT_SHADER,
  COPY_VERTEX_SHADER,
  COPY_FRAGMENT_SHADER
} from './ShaderTemplates';

// Capability detection
export { WebGLCapabilities } from './WebGLCapabilities';
export type { WebGLCapabilityInfo, FeatureSupport } from './WebGLCapabilities';

// Utility functions
export const WebGLUtils = {
  /**
   * Check if WebGL is supported in the current environment
   */
  isSupported: (): boolean => {
    return WebGLCapabilities.isWebGLSupported();
  },

  /**
   * Check if WebGL2 is supported in the current environment
   */
  isWebGL2Supported: (): boolean => {
    return WebGLCapabilities.isWebGL2Supported();
  },

  /**
   * Get WebGL capabilities information
   */
  getCapabilities: (): WebGLCapabilityInfo => {
    return WebGLCapabilities.getInstance().getCapabilityInfo();
  },

  /**
   * Create identity matrix for 2D transformations
   */
  createIdentityMatrix: (): Float32Array => {
    return new Float32Array([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ]);
  },

  /**
   * Create translation matrix for 2D transformations
   */
  createTranslationMatrix: (x: number, y: number): Float32Array => {
    return new Float32Array([
      1, 0, x,
      0, 1, y,
      0, 0, 1
    ]);
  },

  /**
   * Create scale matrix for 2D transformations
   */
  createScaleMatrix: (scaleX: number, scaleY: number): Float32Array => {
    return new Float32Array([
      scaleX, 0, 0,
      0, scaleY, 0,
      0, 0, 1
    ]);
  },

  /**
   * Create rotation matrix for 2D transformations
   */
  createRotationMatrix: (angleRadians: number): Float32Array => {
    const cos = Math.cos(angleRadians);
    const sin = Math.sin(angleRadians);
    return new Float32Array([
      cos, -sin, 0,
      sin, cos, 0,
      0, 0, 1
    ]);
  },

  /**
   * Multiply two 3x3 matrices
   */
  multiplyMatrices: (a: Float32Array, b: Float32Array): Float32Array => {
    const result = new Float32Array(9);
    
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        result[i * 3 + j] = 
          a[i * 3 + 0] * b[0 * 3 + j] +
          a[i * 3 + 1] * b[1 * 3 + j] +
          a[i * 3 + 2] * b[2 * 3 + j];
      }
    }
    
    return result;
  },

  /**
   * Convert Canvas 2D coordinates to WebGL coordinates
   */
  canvasToWebGL: (
    x: number, 
    y: number, 
    canvasWidth: number, 
    canvasHeight: number
  ): { x: number; y: number } => {
    return {
      x: (x / canvasWidth) * 2 - 1,
      y: -((y / canvasHeight) * 2 - 1) // Flip Y axis
    };
  },

  /**
   * Convert WebGL coordinates to Canvas 2D coordinates
   */
  webGLToCanvas: (
    x: number, 
    y: number, 
    canvasWidth: number, 
    canvasHeight: number
  ): { x: number; y: number } => {
    return {
      x: ((x + 1) / 2) * canvasWidth,
      y: ((-y + 1) / 2) * canvasHeight // Flip Y axis
    };
  },

  /**
   * Create a WebGL texture from image data
   */
  createTexture: (
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    image: HTMLImageElement | HTMLCanvasElement | ImageData,
    options: {
      wrapS?: number;
      wrapT?: number;
      minFilter?: number;
      magFilter?: number;
      flipY?: boolean;
    } = {}
  ): WebGLTexture | null => {
    const texture = gl.createTexture();
    if (!texture) return null;

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, options.wrapS || gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, options.wrapT || gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, options.minFilter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, options.magFilter || gl.LINEAR);

    // Set pixel store parameters
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, options.flipY !== false);

    // Upload texture data
    if (image instanceof ImageData) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, image.width, image.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, image.data);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    }

    return texture;
  },

  /**
   * Resize a canvas and update its resolution
   */
  resizeCanvas: (
    canvas: HTMLCanvasElement,
    renderer: WebGLRenderer,
    width: number,
    height: number,
    devicePixelRatio: number = window.devicePixelRatio || 1
  ): void => {
    const actualWidth = width * devicePixelRatio;
    const actualHeight = height * devicePixelRatio;

    // Set the actual size in memory
    canvas.width = actualWidth;
    canvas.height = actualHeight;

    // Scale the canvas back down using CSS
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Update renderer viewport
    renderer.resize(actualWidth, actualHeight);
  }
};

// Re-export WebGL types for convenience
export type WebGLContext = WebGLRenderingContext | WebGL2RenderingContext;