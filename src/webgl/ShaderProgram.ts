/**
 * WebGL Shader Program Management
 * Handles shader compilation, program linking, and uniform/attribute management
 * Uses ShaderCache for optimized compilation performance
 */

import { ShaderCache, CachedProgram } from './ShaderCache';

export interface ShaderProgramInfo {
  /** Program name for debugging */
  name?: string;
  /** Vertex shader source code */
  vertexSource: string;
  /** Fragment shader source code */
  fragmentSource: string;
  /** Attribute locations to bind */
  attributes?: Record<string, number>;
  /** Expected uniform names for validation */
  uniforms?: string[];
}

export interface UniformInfo {
  location: WebGLUniformLocation;
  type: number;
  size: number;
}

export interface AttributeInfo {
  location: number;
  type: number;
  size: number;
}

/**
 * WebGL shader program wrapper with automatic compilation and linking
 */
export class ShaderProgram {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vertexSource: string;
  private fragmentSource: string;
  private uniformLocations: Map<string, WebGLUniformLocation> = new Map();
  private attributeLocations: Map<string, number> = new Map();
  private uniformInfo: Map<string, UniformInfo> = new Map();
  private attributeInfo: Map<string, AttributeInfo> = new Map();
  private debug: boolean;
  private name: string;
  private shaderCache: ShaderCache;
  private cachedProgram: CachedProgram | null = null;

  constructor(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string,
    debug: boolean = false,
    name: string = 'unnamed'
  ) {
    this.gl = gl;
    this.vertexSource = vertexSource;
    this.fragmentSource = fragmentSource;
    this.debug = debug;
    this.name = name;
    this.shaderCache = ShaderCache.getInstance();

    this.compile();
  }

  /**
   * Compile shaders and link program using cache
   */
  private compile(): void {
    try {
      // Use shader cache for optimized compilation
      this.cachedProgram = this.shaderCache.linkProgram(
        this.gl,
        this.vertexSource,
        this.fragmentSource
      );

      this.program = this.cachedProgram.program;
      
      // Use cached uniform and attribute locations
      this.uniformLocations = new Map(this.cachedProgram.uniformLocations);
      this.attributeLocations = new Map(this.cachedProgram.attributeLocations);

      // Still need to cache the detailed info for our API
      this.cacheUniformsAndAttributes();

      this.log(`Shader program "${this.name}" compiled successfully (cached: ${this.shaderCache.hasProgram(this.vertexSource, this.fragmentSource)})`);
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }


  /**
   * Cache uniform and attribute locations and info
   */
  private cacheUniformsAndAttributes(): void {
    if (!this.program) return;

    // Cache uniforms
    const numUniforms = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const uniformInfo = this.gl.getActiveUniform(this.program, i);
      if (uniformInfo) {
        const location = this.gl.getUniformLocation(this.program, uniformInfo.name);
        if (location) {
          this.uniformLocations.set(uniformInfo.name, location);
          this.uniformInfo.set(uniformInfo.name, {
            location,
            type: uniformInfo.type,
            size: uniformInfo.size
          });
        }
      }
    }

    // Cache attributes
    const numAttributes = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < numAttributes; i++) {
      const attributeInfo = this.gl.getActiveAttrib(this.program, i);
      if (attributeInfo) {
        const location = this.gl.getAttribLocation(this.program, attributeInfo.name);
        this.attributeLocations.set(attributeInfo.name, location);
        this.attributeInfo.set(attributeInfo.name, {
          location,
          type: attributeInfo.type,
          size: attributeInfo.size
        });
      }
    }

    this.log(`Cached ${this.uniformLocations.size} uniforms and ${this.attributeLocations.size} attributes`);
  }

  /**
   * Use this shader program for rendering
   */
  public use(): void {
    if (!this.program) {
      throw new Error('Shader program not compiled');
    }
    this.gl.useProgram(this.program);
  }

  /**
   * Get uniform location (cached)
   */
  public getUniformLocation(name: string): WebGLUniformLocation | null {
    return this.uniformLocations.get(name) || null;
  }

  /**
   * Get attribute location (cached)
   */
  public getAttributeLocation(name: string): number {
    const location = this.attributeLocations.get(name);
    return location !== undefined ? location : -1;
  }

  /**
   * Set uniform values with type checking
   */
  public setUniform(name: string, value: number | number[] | Float32Array | Int32Array): void {
    const location = this.getUniformLocation(name);
    if (!location) {
      if (this.debug) {
        console.warn(`[ShaderProgram] Uniform "${name}" not found in program "${this.name}"`);
      }
      return;
    }

    // Handle different uniform types
    if (typeof value === 'number') {
      this.gl.uniform1f(location, value);
    } else if (Array.isArray(value) || value instanceof Float32Array || value instanceof Int32Array) {
      switch (value.length) {
        case 1:
          this.gl.uniform1f(location, value[0]);
          break;
        case 2:
          this.gl.uniform2fv(location, value);
          break;
        case 3:
          this.gl.uniform3fv(location, value);
          break;
        case 4:
          this.gl.uniform4fv(location, value);
          break;
        case 9:
          this.gl.uniformMatrix3fv(location, false, value);
          break;
        case 16:
          this.gl.uniformMatrix4fv(location, false, value);
          break;
        default:
          throw new Error(`Unsupported uniform array length: ${value.length}`);
      }
    } else {
      throw new Error(`Unsupported uniform type for "${name}"`);
    }
  }

  /**
   * Set integer uniform values
   */
  public setUniformInt(name: string, value: number | number[]): void {
    const location = this.getUniformLocation(name);
    if (!location) {
      if (this.debug) {
        console.warn(`[ShaderProgram] Uniform "${name}" not found in program "${this.name}"`);
      }
      return;
    }

    if (typeof value === 'number') {
      this.gl.uniform1i(location, value);
    } else if (Array.isArray(value)) {
      switch (value.length) {
        case 1:
          this.gl.uniform1i(location, value[0]);
          break;
        case 2:
          this.gl.uniform2iv(location, value);
          break;
        case 3:
          this.gl.uniform3iv(location, value);
          break;
        case 4:
          this.gl.uniform4iv(location, value);
          break;
        default:
          throw new Error(`Unsupported integer uniform array length: ${value.length}`);
      }
    }
  }

  /**
   * Set texture uniform (sampler2D)
   */
  public setTexture(name: string, texture: WebGLTexture, unit: number): void {
    const location = this.getUniformLocation(name);
    if (!location) {
      if (this.debug) {
        console.warn(`[ShaderProgram] Texture uniform "${name}" not found in program "${this.name}"`);
      }
      return;
    }

    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.uniform1i(location, unit);
  }

  /**
   * Enable vertex attribute
   */
  public enableAttribute(name: string): void {
    const location = this.getAttributeLocation(name);
    if (location >= 0) {
      this.gl.enableVertexAttribArray(location);
    } else if (this.debug) {
      console.warn(`[ShaderProgram] Attribute "${name}" not found in program "${this.name}"`);
    }
  }

  /**
   * Disable vertex attribute
   */
  public disableAttribute(name: string): void {
    const location = this.getAttributeLocation(name);
    if (location >= 0) {
      this.gl.disableVertexAttribArray(location);
    }
  }

  /**
   * Set vertex attribute pointer
   */
  public setAttributePointer(
    name: string,
    size: number,
    type: number = this.gl.FLOAT,
    normalized: boolean = false,
    stride: number = 0,
    offset: number = 0
  ): void {
    const location = this.getAttributeLocation(name);
    if (location >= 0) {
      this.gl.vertexAttribPointer(location, size, type, normalized, stride, offset);
    } else if (this.debug) {
      console.warn(`[ShaderProgram] Attribute "${name}" not found in program "${this.name}"`);
    }
  }

  /**
   * Get all uniform names
   */
  public getUniformNames(): string[] {
    return Array.from(this.uniformLocations.keys());
  }

  /**
   * Get all attribute names
   */
  public getAttributeNames(): string[] {
    return Array.from(this.attributeLocations.keys());
  }

  /**
   * Get uniform information
   */
  public getUniformInfo(name: string): UniformInfo | null {
    return this.uniformInfo.get(name) || null;
  }

  /**
   * Get attribute information
   */
  public getAttributeInfo(name: string): AttributeInfo | null {
    return this.attributeInfo.get(name) || null;
  }

  /**
   * Check if the program is ready for use
   */
  public isReady(): boolean {
    return this.program !== null;
  }

  /**
   * Recompile the shader program (useful after context restore)
   */
  public recompile(): void {
    this.cleanup();
    // Clear cache entry to force recompilation
    this.shaderCache.clearCache(this.gl);
    this.compile();
  }

  /**
   * Clean up shader resources (cache handles actual WebGL cleanup)
   */
  private cleanup(): void {
    // Note: We don't delete shaders/programs here as they're managed by the cache
    // The cache will handle cleanup when appropriate
    this.program = null;
    this.cachedProgram = null;

    this.uniformLocations.clear();
    this.attributeLocations.clear();
    this.uniformInfo.clear();
    this.attributeInfo.clear();
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.cleanup();
    this.log(`Shader program "${this.name}" disposed`);
  }

  /**
   * Debug logging utility
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(`[ShaderProgram:${this.name}] ${message}`);
    }
  }

  /**
   * Get the WebGL program object
   */
  public getProgram(): WebGLProgram | null {
    return this.program;
  }

  /**
   * Get shader cache statistics
   */
  public getCacheStats(): string {
    return this.shaderCache.getDebugInfo();
  }

  /**
   * Check if this program was loaded from cache
   */
  public isFromCache(): boolean {
    return this.shaderCache.hasProgram(this.vertexSource, this.fragmentSource);
  }

  /**
   * Static utility to validate shader source for common issues
   */
  public static validateShaderSource(source: string, type: 'vertex' | 'fragment'): string[] {
    const issues: string[] = [];

    // Check for precision qualifiers in fragment shaders
    if (type === 'fragment' && !source.includes('precision')) {
      issues.push('Fragment shader should include precision qualifier (e.g., "precision mediump float;")');
    }

    // Check for main function
    if (!source.includes('void main(')) {
      issues.push('Shader must contain a main() function');
    }

    // Check for gl_Position in vertex shaders
    if (type === 'vertex' && !source.includes('gl_Position')) {
      issues.push('Vertex shader must set gl_Position');
    }

    // Check for gl_FragColor or output variables in fragment shaders
    if (type === 'fragment' && !source.includes('gl_FragColor') && !source.includes('out ')) {
      issues.push('Fragment shader must set gl_FragColor or use output variables');
    }

    return issues;
  }
}