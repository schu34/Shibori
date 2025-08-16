/**
 * WebGL Capability Detection and Fallback Management
 * Detects WebGL support and provides graceful fallback to Canvas 2D
 */

export interface WebGLCapabilityInfo {
  /** Whether WebGL is supported */
  webglSupported: boolean;
  /** Whether WebGL2 is supported */
  webgl2Supported: boolean;
  /** Maximum texture size */
  maxTextureSize: number;
  /** Maximum viewport dimensions */
  maxViewportDims: [number, number];
  /** Maximum vertex attributes */
  maxVertexAttribs: number;
  /** Maximum varying vectors */
  maxVaryingVectors: number;
  /** Maximum fragment uniform vectors */
  maxFragmentUniforms: number;
  /** Maximum vertex uniform vectors */
  maxVertexUniforms: number;
  /** GPU renderer string */
  renderer: string;
  /** GPU vendor string */
  vendor: string;
  /** WebGL version string */
  version: string;
  /** Supported extensions */
  extensions: string[];
  /** Performance tier estimate */
  performanceTier: 'high' | 'medium' | 'low' | 'unknown';
}

export interface FeatureSupport {
  /** Whether floating point textures are supported */
  floatTextures: boolean;
  /** Whether half-float textures are supported */
  halfFloatTextures: boolean;
  /** Whether instanced drawing is supported */
  instancedDrawing: boolean;
  /** Whether vertex array objects are supported */
  vertexArrayObjects: boolean;
  /** Whether multiple render targets are supported */
  multipleRenderTargets: boolean;
  /** Whether depth textures are supported */
  depthTextures: boolean;
}

/**
 * Detect WebGL capabilities and determine fallback strategy
 */
export class WebGLCapabilities {
  private static instance: WebGLCapabilities | null = null;
  private capabilityInfo: WebGLCapabilityInfo | null = null;
  private featureSupport: FeatureSupport | null = null;

  private constructor() {
    this.detectCapabilities();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): WebGLCapabilities {
    if (!WebGLCapabilities.instance) {
      WebGLCapabilities.instance = new WebGLCapabilities();
    }
    return WebGLCapabilities.instance;
  }

  /**
   * Quick check for WebGL support
   */
  public static isWebGLSupported(): boolean {
    return WebGLCapabilities.getInstance().getCapabilityInfo().webglSupported;
  }

  /**
   * Quick check for WebGL2 support
   */
  public static isWebGL2Supported(): boolean {
    return WebGLCapabilities.getInstance().getCapabilityInfo().webgl2Supported;
  }

  /**
   * Detect all WebGL capabilities
   */
  private detectCapabilities(): void {
    const canvas = document.createElement('canvas');
    let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    let isWebGL2 = false;

    // Try WebGL2 first
    try {
      gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
      if (gl) {
        isWebGL2 = true;
      }
    } catch (error) {
      // WebGL2 not supported
    }

    // Fallback to WebGL1
    if (!gl) {
      try {
        gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      } catch (error) {
        // WebGL not supported
      }
    }

    if (!gl) {
      // No WebGL support
      this.capabilityInfo = {
        webglSupported: false,
        webgl2Supported: false,
        maxTextureSize: 0,
        maxViewportDims: [0, 0],
        maxVertexAttribs: 0,
        maxVaryingVectors: 0,
        maxFragmentUniforms: 0,
        maxVertexUniforms: 0,
        renderer: 'No WebGL Support',
        vendor: 'Unknown',
        version: 'None',
        extensions: [],
        performanceTier: 'unknown'
      };

      this.featureSupport = {
        floatTextures: false,
        halfFloatTextures: false,
        instancedDrawing: false,
        vertexArrayObjects: false,
        multipleRenderTargets: false,
        depthTextures: false
      };
      return;
    }

    // Get basic capability information
    const extensions = gl.getSupportedExtensions() || [];
    
    this.capabilityInfo = {
      webglSupported: true,
      webgl2Supported: isWebGL2,
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
      maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
      maxFragmentUniforms: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      maxVertexUniforms: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
      renderer: gl.getParameter(gl.RENDERER),
      vendor: gl.getParameter(gl.VENDOR),
      version: gl.getParameter(gl.VERSION),
      extensions,
      performanceTier: this.estimatePerformanceTier(gl, extensions)
    };

    // Detect feature support
    this.featureSupport = {
      floatTextures: this.checkFloatTextureSupport(gl, extensions, isWebGL2),
      halfFloatTextures: this.checkHalfFloatTextureSupport(gl, extensions, isWebGL2),
      instancedDrawing: isWebGL2 || extensions.includes('ANGLE_instanced_arrays'),
      vertexArrayObjects: isWebGL2 || extensions.includes('OES_vertex_array_object'),
      multipleRenderTargets: isWebGL2 || extensions.includes('WEBGL_draw_buffers'),
      depthTextures: isWebGL2 || extensions.includes('WEBGL_depth_texture')
    };

    // Clean up test canvas
    canvas.remove();
  }

  /**
   * Check if floating point textures are supported
   */
  private checkFloatTextureSupport(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    extensions: string[],
    isWebGL2: boolean
  ): boolean {
    if (isWebGL2) {
      return true; // WebGL2 supports float textures natively
    }
    return extensions.includes('OES_texture_float');
  }

  /**
   * Check if half-float textures are supported
   */
  private checkHalfFloatTextureSupport(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    extensions: string[],
    isWebGL2: boolean
  ): boolean {
    if (isWebGL2) {
      return true; // WebGL2 supports half-float textures natively
    }
    return extensions.includes('OES_texture_half_float');
  }

  /**
   * Estimate performance tier based on GPU and capabilities
   */
  private estimatePerformanceTier(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    extensions: string[]
  ): 'high' | 'medium' | 'low' | 'unknown' {
    const renderer = gl.getParameter(gl.RENDERER).toLowerCase();
    const vendor = gl.getParameter(gl.VENDOR).toLowerCase();
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

    // High performance indicators
    if (renderer.includes('nvidia') || renderer.includes('amd') || renderer.includes('radeon')) {
      if (maxTextureSize >= 8192) {
        return 'high';
      }
    }

    // Apple/Mac high performance
    if (vendor.includes('apple') && (renderer.includes('pro') || renderer.includes('radeon'))) {
      return 'high';
    }

    // Mobile/integrated graphics indicators
    if (renderer.includes('mali') || renderer.includes('adreno') || renderer.includes('powervr')) {
      return 'low';
    }

    // Intel integrated graphics
    if (renderer.includes('intel')) {
      if (renderer.includes('iris') || renderer.includes('uhd')) {
        return 'medium';
      }
      return 'low';
    }

    // Generic heuristics based on capabilities
    if (maxTextureSize >= 8192 && extensions.length > 20) {
      return 'high';
    } else if (maxTextureSize >= 4096 && extensions.length > 10) {
      return 'medium';
    } else if (maxTextureSize >= 2048) {
      return 'low';
    }

    return 'unknown';
  }

  /**
   * Get capability information
   */
  public getCapabilityInfo(): WebGLCapabilityInfo {
    if (!this.capabilityInfo) {
      this.detectCapabilities();
    }
    return this.capabilityInfo!;
  }

  /**
   * Get feature support information
   */
  public getFeatureSupport(): FeatureSupport {
    if (!this.featureSupport) {
      this.detectCapabilities();
    }
    return this.featureSupport!;
  }

  /**
   * Check if WebGL should be used based on capabilities and preferences
   */
  public shouldUseWebGL(userPreference: 'auto' | 'webgl' | 'canvas2d' = 'auto'): boolean {
    if (userPreference === 'canvas2d') {
      return false;
    }

    if (userPreference === 'webgl') {
      return this.getCapabilityInfo().webglSupported;
    }

    // Auto mode - use heuristics
    const capabilities = this.getCapabilityInfo();
    
    if (!capabilities.webglSupported) {
      return false;
    }

    // Don't use WebGL on very low-end devices
    if (capabilities.performanceTier === 'unknown' && capabilities.maxTextureSize < 2048) {
      return false;
    }

    return true;
  }

  /**
   * Get recommended settings based on performance tier
   */
  public getRecommendedSettings(): {
    useWebGL2: boolean;
    maxTextureSize: number;
    useFloatTextures: boolean;
    useMultisampling: boolean;
    batchSizeHint: number;
  } {
    const capabilities = this.getCapabilityInfo();
    const features = this.getFeatureSupport();

    const settings = {
      useWebGL2: capabilities.webgl2Supported,
      maxTextureSize: Math.min(capabilities.maxTextureSize, 4096), // Reasonable limit
      useFloatTextures: features.floatTextures,
      useMultisampling: false,
      batchSizeHint: 1000
    };

    // Adjust based on performance tier
    switch (capabilities.performanceTier) {
      case 'high':
        settings.maxTextureSize = Math.min(capabilities.maxTextureSize, 8192);
        settings.useMultisampling = true;
        settings.batchSizeHint = 5000;
        break;

      case 'medium':
        settings.maxTextureSize = Math.min(capabilities.maxTextureSize, 4096);
        settings.useMultisampling = false;
        settings.batchSizeHint = 2000;
        break;

      case 'low':
        settings.maxTextureSize = Math.min(capabilities.maxTextureSize, 2048);
        settings.useFloatTextures = false;
        settings.useMultisampling = false;
        settings.batchSizeHint = 500;
        break;
    }

    return settings;
  }

  /**
   * Get debug information string
   */
  public getDebugInfo(): string {
    const capabilities = this.getCapabilityInfo();
    const features = this.getFeatureSupport();

    const info = [
      `WebGL Support: ${capabilities.webglSupported ? 'Yes' : 'No'}`,
      `WebGL2 Support: ${capabilities.webgl2Supported ? 'Yes' : 'No'}`,
      `Renderer: ${capabilities.renderer}`,
      `Vendor: ${capabilities.vendor}`,
      `Version: ${capabilities.version}`,
      `Performance Tier: ${capabilities.performanceTier}`,
      `Max Texture Size: ${capabilities.maxTextureSize}`,
      `Max Viewport: ${capabilities.maxViewportDims[0]}x${capabilities.maxViewportDims[1]}`,
      `Extensions: ${capabilities.extensions.length}`,
      `Float Textures: ${features.floatTextures ? 'Yes' : 'No'}`,
      `VAO Support: ${features.vertexArrayObjects ? 'Yes' : 'No'}`,
      `Instancing: ${features.instancedDrawing ? 'Yes' : 'No'}`
    ];

    return info.join('\n');
  }

  /**
   * Reset capability detection (useful for testing)
   */
  public reset(): void {
    this.capabilityInfo = null;
    this.featureSupport = null;
    this.detectCapabilities();
  }
}