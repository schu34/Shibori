/**
 * WebGL Buffer Management
 * Handles creation, updating, and disposal of vertex buffers, index buffers, and data management
 */

export interface BufferConfig {
  /** Buffer name for identification */
  name?: string;
  /** Buffer usage pattern */
  usage?: number;
  /** Buffer type (ARRAY_BUFFER or ELEMENT_ARRAY_BUFFER) */
  type?: number;
  /** Initial data size hint for optimization */
  initialSize?: number;
}

export interface BufferInfo {
  buffer: WebGLBuffer;
  type: number;
  usage: number;
  size: number;
  name: string;
}

export interface GeometryData {
  /** Vertex positions (x, y, z) */
  positions: Float32Array;
  /** Texture coordinates (u, v) */
  texCoords?: Float32Array;
  /** Vertex colors (r, g, b, a) */
  colors?: Float32Array;
  /** Vertex indices for indexed drawing */
  indices?: Uint16Array | Uint32Array;
  /** Custom vertex attributes */
  attributes?: Record<string, Float32Array>;
}

/**
 * Manages WebGL buffers for efficient vertex data handling
 */
export class BufferManager {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private buffers: Map<string, BufferInfo> = new Map();
  private debug: boolean;
  private nextBufferId: number = 0;

  constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, debug: boolean = false) {
    this.gl = gl;
    this.debug = debug;
  }

  /**
   * Create a new buffer with optional initial data
   */
  public createBuffer(
    data?: ArrayBuffer | ArrayBufferView,
    config: BufferConfig = {}
  ): string {
    const buffer = this.gl.createBuffer();
    if (!buffer) {
      throw new Error('Failed to create WebGL buffer');
    }

    const bufferId = config.name || `buffer_${this.nextBufferId++}`;
    const type = config.type || this.gl.ARRAY_BUFFER;
    const usage = config.usage || this.gl.STATIC_DRAW;

    // Bind and upload data if provided
    this.gl.bindBuffer(type, buffer);
    if (data) {
      this.gl.bufferData(type, data, usage);
    } else if (config.initialSize) {
      this.gl.bufferData(type, config.initialSize, usage);
    }

    const bufferInfo: BufferInfo = {
      buffer,
      type,
      usage,
      size: data ? data.byteLength : (config.initialSize || 0),
      name: bufferId
    };

    this.buffers.set(bufferId, bufferInfo);
    this.log(`Created buffer "${bufferId}" (${bufferInfo.size} bytes)`);

    return bufferId;
  }

  /**
   * Create vertex buffer from geometry data
   */
  public createGeometryBuffers(geometry: GeometryData, namePrefix: string = 'geometry'): {
    position: string;
    texCoord?: string;
    color?: string;
    index?: string;
    attributes?: Record<string, string>;
  } {
    const bufferIds: any = {};

    // Position buffer (required)
    bufferIds.position = this.createBuffer(geometry.positions, {
      name: `${namePrefix}_position`,
      type: this.gl.ARRAY_BUFFER,
      usage: this.gl.STATIC_DRAW
    });

    // Texture coordinate buffer (optional)
    if (geometry.texCoords) {
      bufferIds.texCoord = this.createBuffer(geometry.texCoords, {
        name: `${namePrefix}_texCoord`,
        type: this.gl.ARRAY_BUFFER,
        usage: this.gl.STATIC_DRAW
      });
    }

    // Color buffer (optional)
    if (geometry.colors) {
      bufferIds.color = this.createBuffer(geometry.colors, {
        name: `${namePrefix}_color`,
        type: this.gl.ARRAY_BUFFER,
        usage: this.gl.STATIC_DRAW
      });
    }

    // Index buffer (optional)
    if (geometry.indices) {
      bufferIds.index = this.createBuffer(geometry.indices, {
        name: `${namePrefix}_index`,
        type: this.gl.ELEMENT_ARRAY_BUFFER,
        usage: this.gl.STATIC_DRAW
      });
    }

    // Custom attribute buffers (optional)
    if (geometry.attributes) {
      bufferIds.attributes = {};
      for (const [attrName, attrData] of Object.entries(geometry.attributes)) {
        bufferIds.attributes[attrName] = this.createBuffer(attrData, {
          name: `${namePrefix}_${attrName}`,
          type: this.gl.ARRAY_BUFFER,
          usage: this.gl.STATIC_DRAW
        });
      }
    }

    return bufferIds;
  }

  /**
   * Update buffer data
   */
  public updateBuffer(
    bufferId: string,
    data: ArrayBuffer | ArrayBufferView,
    offset: number = 0
  ): void {
    const bufferInfo = this.buffers.get(bufferId);
    if (!bufferInfo) {
      throw new Error(`Buffer "${bufferId}" not found`);
    }

    this.gl.bindBuffer(bufferInfo.type, bufferInfo.buffer);

    if (offset === 0 && data.byteLength <= bufferInfo.size) {
      // Update existing buffer data
      this.gl.bufferSubData(bufferInfo.type, offset, data);
    } else {
      // Reallocate buffer if data is larger or offset is non-zero
      this.gl.bufferData(bufferInfo.type, data, bufferInfo.usage);
      bufferInfo.size = data.byteLength;
    }

    this.log(`Updated buffer "${bufferId}" with ${data.byteLength} bytes`);
  }

  /**
   * Bind a buffer for use
   */
  public bindBuffer(bufferId: string): void {
    const bufferInfo = this.buffers.get(bufferId);
    if (!bufferInfo) {
      throw new Error(`Buffer "${bufferId}" not found`);
    }

    this.gl.bindBuffer(bufferInfo.type, bufferInfo.buffer);
  }

  /**
   * Get buffer information
   */
  public getBufferInfo(bufferId: string): BufferInfo | null {
    return this.buffers.get(bufferId) || null;
  }

  /**
   * Get buffer WebGL object
   */
  public getBuffer(bufferId: string): WebGLBuffer | null {
    const bufferInfo = this.buffers.get(bufferId);
    return bufferInfo ? bufferInfo.buffer : null;
  }

  /**
   * Check if buffer exists
   */
  public hasBuffer(bufferId: string): boolean {
    return this.buffers.has(bufferId);
  }

  /**
   * Delete a specific buffer
   */
  public deleteBuffer(bufferId: string): void {
    const bufferInfo = this.buffers.get(bufferId);
    if (bufferInfo) {
      this.gl.deleteBuffer(bufferInfo.buffer);
      this.buffers.delete(bufferId);
      this.log(`Deleted buffer "${bufferId}"`);
    }
  }

  /**
   * Create a quad (rectangle) geometry
   */
  public createQuadGeometry(
    width: number = 2,
    height: number = 2,
    centerX: number = 0,
    centerY: number = 0
  ): GeometryData {
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const positions = new Float32Array([
      centerX - halfWidth, centerY - halfHeight, 0, // Bottom-left
      centerX + halfWidth, centerY - halfHeight, 0, // Bottom-right
      centerX + halfWidth, centerY + halfHeight, 0, // Top-right
      centerX - halfWidth, centerY + halfHeight, 0  // Top-left
    ]);

    const texCoords = new Float32Array([
      0, 0, // Bottom-left
      1, 0, // Bottom-right
      1, 1, // Top-right
      0, 1  // Top-left
    ]);

    const indices = new Uint16Array([
      0, 1, 2,  // First triangle
      2, 3, 0   // Second triangle
    ]);

    return {
      positions,
      texCoords,
      indices
    };
  }

  /**
   * Create a line geometry from points
   */
  public createLineGeometry(points: Array<{x: number, y: number}>): GeometryData {
    const positions = new Float32Array(points.length * 3);
    
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = points[i].y;
      positions[i * 3 + 2] = 0;
    }

    return { positions };
  }

  /**
   * Create a triangle strip geometry for smooth lines
   */
  public createLineStripGeometry(
    points: Array<{x: number, y: number}>,
    thickness: number = 1
  ): GeometryData {
    if (points.length < 2) {
      throw new Error('Line strip requires at least 2 points');
    }

    const positions: number[] = [];
    const indices: number[] = [];

    const halfThickness = thickness / 2;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      let perpX = 0, perpY = 1; // Default perpendicular vector

      // Calculate perpendicular vector for line thickness
      if (i > 0) {
        const prev = points[i - 1];
        const dx = point.x - prev.x;
        const dy = point.y - prev.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
          perpX = -dy / length;
          perpY = dx / length;
        }
      } else if (i < points.length - 1) {
        const next = points[i + 1];
        const dx = next.x - point.x;
        const dy = next.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
          perpX = -dy / length;
          perpY = dx / length;
        }
      }

      // Add two vertices per point (for line thickness)
      const vertexIndex = i * 2;
      
      // Top vertex
      positions.push(
        point.x + perpX * halfThickness,
        point.y + perpY * halfThickness,
        0
      );
      
      // Bottom vertex
      positions.push(
        point.x - perpX * halfThickness,
        point.y - perpY * halfThickness,
        0
      );

      // Add triangle indices (except for last point)
      if (i < points.length - 1) {
        // First triangle
        indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
        // Second triangle
        indices.push(vertexIndex + 1, vertexIndex + 3, vertexIndex + 2);
      }
    }

    return {
      positions: new Float32Array(positions),
      indices: new Uint16Array(indices)
    };
  }

  /**
   * Get all buffer names
   */
  public getBufferNames(): string[] {
    return Array.from(this.buffers.keys());
  }

  /**
   * Get memory usage statistics
   */
  public getMemoryUsage(): {
    totalBuffers: number;
    totalBytes: number;
    bufferDetails: Array<{name: string, size: number, type: string}>;
  } {
    let totalBytes = 0;
    const bufferDetails: Array<{name: string, size: number, type: string}> = [];

    for (const [name, info] of this.buffers) {
      totalBytes += info.size;
      const typeString = info.type === this.gl.ARRAY_BUFFER ? 'ARRAY_BUFFER' : 'ELEMENT_ARRAY_BUFFER';
      bufferDetails.push({
        name,
        size: info.size,
        type: typeString
      });
    }

    return {
      totalBuffers: this.buffers.size,
      totalBytes,
      bufferDetails
    };
  }

  /**
   * Dispose of all buffers
   */
  public dispose(): void {
    for (const [name, bufferInfo] of this.buffers) {
      this.gl.deleteBuffer(bufferInfo.buffer);
      this.log(`Disposed buffer "${name}"`);
    }
    this.buffers.clear();
    this.log('All buffers disposed');
  }

  /**
   * Debug logging utility
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(`[BufferManager] ${message}`);
    }
  }
}