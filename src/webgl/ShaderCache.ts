/**
 * WebGL Shader Cache System
 * Optimizes shader compilation by caching compiled shaders and programs
 */

export interface CachedShader {
  shader: WebGLShader;
  source: string;
  type: number;
  compiledAt: number;
}

export interface CachedProgram {
  program: WebGLProgram;
  vertexSource: string;
  fragmentSource: string;
  linkedAt: number;
  uniformLocations: Map<string, WebGLUniformLocation>;
  attributeLocations: Map<string, number>;
}

export interface ShaderCacheStats {
  totalShaders: number;
  totalPrograms: number;
  cacheHits: number;
  cacheMisses: number;
  memoryUsage: number;
  compilationTime: number;
  linkingTime: number;
}

/**
 * Global shader cache for optimizing WebGL performance
 */
export class ShaderCache {
  private static instance: ShaderCache | null = null;
  private shaderCache = new Map<string, CachedShader>();
  private programCache = new Map<string, CachedProgram>();
  private stats: ShaderCacheStats = {
    totalShaders: 0,
    totalPrograms: 0,
    cacheHits: 0,
    cacheMisses: 0,
    memoryUsage: 0,
    compilationTime: 0,
    linkingTime: 0
  };

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ShaderCache {
    if (!ShaderCache.instance) {
      ShaderCache.instance = new ShaderCache();
    }
    return ShaderCache.instance;
  }

  /**
   * Generate cache key for shader
   */
  private getShaderKey(source: string, type: number): string {
    const typeStr = type === WebGLRenderingContext.VERTEX_SHADER ? 'vertex' : 'fragment';
    return `${typeStr}_${this.hashCode(source)}`;
  }

  /**
   * Generate cache key for program
   */
  private getProgramKey(vertexSource: string, fragmentSource: string): string {
    const vertexHash = this.hashCode(vertexSource);
    const fragmentHash = this.hashCode(fragmentSource);
    return `program_${vertexHash}_${fragmentHash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private hashCode(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Compile shader with caching
   */
  public compileShader(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    source: string,
    type: number
  ): WebGLShader {
    const key = this.getShaderKey(source, type);
    const cached = this.shaderCache.get(key);

    if (cached) {
      this.stats.cacheHits++;
      return cached.shader;
    }

    this.stats.cacheMisses++;
    const startTime = performance.now();

    // Compile new shader
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error('Failed to create shader');
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${error}`);
    }

    const compilationTime = performance.now() - startTime;
    this.stats.compilationTime += compilationTime;

    // Cache the compiled shader
    const cachedShader: CachedShader = {
      shader,
      source,
      type,
      compiledAt: Date.now()
    };

    this.shaderCache.set(key, cachedShader);
    this.stats.totalShaders++;
    this.updateMemoryUsage();

    return shader;
  }

  /**
   * Link program with caching
   */
  public linkProgram(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string
  ): CachedProgram {
    const key = this.getProgramKey(vertexSource, fragmentSource);
    const cached = this.programCache.get(key);

    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }

    this.stats.cacheMisses++;
    const startTime = performance.now();

    // Compile shaders
    const vertexShader = this.compileShader(gl, vertexSource, gl.VERTEX_SHADER);
    const fragmentShader = this.compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);

    // Create and link program
    const program = gl.createProgram();
    if (!program) {
      throw new Error('Failed to create program');
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program linking failed: ${error}`);
    }

    const linkingTime = performance.now() - startTime;
    this.stats.linkingTime += linkingTime;

    // Cache uniform and attribute locations
    const uniformLocations = new Map<string, WebGLUniformLocation>();
    const attributeLocations = new Map<string, number>();

    // Cache uniforms
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const uniformInfo = gl.getActiveUniform(program, i);
      if (uniformInfo) {
        const location = gl.getUniformLocation(program, uniformInfo.name);
        if (location) {
          uniformLocations.set(uniformInfo.name, location);
        }
      }
    }

    // Cache attributes
    const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < numAttributes; i++) {
      const attributeInfo = gl.getActiveAttrib(program, i);
      if (attributeInfo) {
        const location = gl.getAttribLocation(program, attributeInfo.name);
        attributeLocations.set(attributeInfo.name, location);
      }
    }

    // Cache the program
    const cachedProgram: CachedProgram = {
      program,
      vertexSource,
      fragmentSource,
      linkedAt: Date.now(),
      uniformLocations,
      attributeLocations
    };

    this.programCache.set(key, cachedProgram);
    this.stats.totalPrograms++;
    this.updateMemoryUsage();

    return cachedProgram;
  }

  /**
   * Pre-compile common shaders
   */
  public precompileShaders(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    shaderSources: Array<{ vertex: string; fragment: string; name: string }>
  ): void {
    console.log(`[ShaderCache] Pre-compiling ${shaderSources.length} shader programs...`);
    
    const startTime = performance.now();
    
    for (const { vertex, fragment, name } of shaderSources) {
      try {
        this.linkProgram(gl, vertex, fragment);
        console.log(`[ShaderCache] Pre-compiled: ${name}`);
      } catch (error) {
        console.warn(`[ShaderCache] Failed to pre-compile ${name}:`, error);
      }
    }
    
    const totalTime = performance.now() - startTime;
    console.log(`[ShaderCache] Pre-compilation completed in ${totalTime.toFixed(2)}ms`);
  }

  /**
   * Update memory usage estimate
   */
  private updateMemoryUsage(): void {
    // Rough estimate: shader source + compiled shader + program overhead
    this.stats.memoryUsage = 
      (this.stats.totalShaders * 2048) + // ~2KB per shader
      (this.stats.totalPrograms * 1024);  // ~1KB per program
  }

  /**
   * Clear cache and free resources
   */
  public clearCache(gl?: WebGLRenderingContext | WebGL2RenderingContext): void {
    if (gl) {
      // Delete WebGL resources
      for (const cached of this.shaderCache.values()) {
        gl.deleteShader(cached.shader);
      }
      
      for (const cached of this.programCache.values()) {
        gl.deleteProgram(cached.program);
      }
    }

    this.shaderCache.clear();
    this.programCache.clear();
    
    // Reset stats but preserve compilation times for analysis
    const preservedCompilationTime = this.stats.compilationTime;
    const preservedLinkingTime = this.stats.linkingTime;
    
    this.stats = {
      totalShaders: 0,
      totalPrograms: 0,
      cacheHits: 0,
      cacheMisses: 0,
      memoryUsage: 0,
      compilationTime: preservedCompilationTime,
      linkingTime: preservedLinkingTime
    };

    console.log('[ShaderCache] Cache cleared');
  }

  /**
   * Remove old cache entries
   */
  public cleanup(maxAge: number = 300000): void { // 5 minutes default
    const now = Date.now();
    let removedShaders = 0;
    let removedPrograms = 0;

    // Clean old shaders
    for (const [key, cached] of this.shaderCache) {
      if (now - cached.compiledAt > maxAge) {
        this.shaderCache.delete(key);
        removedShaders++;
      }
    }

    // Clean old programs
    for (const [key, cached] of this.programCache) {
      if (now - cached.linkedAt > maxAge) {
        this.programCache.delete(key);
        removedPrograms++;
      }
    }

    if (removedShaders > 0 || removedPrograms > 0) {
      console.log(`[ShaderCache] Cleaned up ${removedShaders} shaders and ${removedPrograms} programs`);
      this.updateMemoryUsage();
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): ShaderCacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache hit ratio
   */
  public getHitRatio(): number {
    const total = this.stats.cacheHits + this.stats.cacheMisses;
    return total > 0 ? this.stats.cacheHits / total : 0;
  }

  /**
   * Check if shader is cached
   */
  public hasShader(source: string, type: number): boolean {
    const key = this.getShaderKey(source, type);
    return this.shaderCache.has(key);
  }

  /**
   * Check if program is cached
   */
  public hasProgram(vertexSource: string, fragmentSource: string): boolean {
    const key = this.getProgramKey(vertexSource, fragmentSource);
    return this.programCache.has(key);
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): string {
    const stats = this.getStats();
    const hitRatio = this.getHitRatio();
    
    return [
      `Shader Cache Statistics:`,
      `  Cached Shaders: ${stats.totalShaders}`,
      `  Cached Programs: ${stats.totalPrograms}`,
      `  Cache Hits: ${stats.cacheHits}`,
      `  Cache Misses: ${stats.cacheMisses}`,
      `  Hit Ratio: ${(hitRatio * 100).toFixed(1)}%`,
      `  Memory Usage: ~${(stats.memoryUsage / 1024).toFixed(1)}KB`,
      `  Compilation Time: ${stats.compilationTime.toFixed(2)}ms`,
      `  Linking Time: ${stats.linkingTime.toFixed(2)}ms`
    ].join('\n');
  }
}