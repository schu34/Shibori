/**
 * WebGL Stroke Renderer
 * Replaces perfect-freehand with GPU-accelerated stroke rendering
 */

import { WebGLRenderer } from './WebGLRenderer';
import { ShaderProgram } from './ShaderProgram';
import { BufferManager, GeometryData } from './BufferManager';
import { getShaderTemplate } from './ShaderTemplates';
import { Point } from '../types/DrawingMode';

export interface StrokeConfig {
  /** Stroke thickness in pixels */
  thickness: number;
  /** Color as [r, g, b, a] where each component is 0-1 */
  color: [number, number, number, number];
  /** Pressure sensitivity (0 = no pressure, 1 = full pressure) */
  pressureSensitivity: number;
  /** Smoothing factor (0 = no smoothing, 1 = maximum smoothing) */
  smoothing: number;
  /** Thinning at stroke ends (0 = no thinning, 1 = maximum thinning) */
  thinning: number;
  /** Opacity (0 = transparent, 1 = opaque) */
  opacity: number;
}

export interface StrokePoint extends Point {
  /** Pressure value (0-1, where 1 is maximum pressure) */
  pressure?: number;
  /** Timestamp for velocity calculations */
  timestamp?: number;
}

interface ProcessedStrokePoint {
  x: number;
  y: number;
  pressure: number;
  velocity: number;
  distance: number;
}

/**
 * WebGL-based stroke renderer that creates smooth, pressure-sensitive strokes
 */
export class WebGLStrokeRenderer {
  private renderer: WebGLRenderer;
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private bufferManager: BufferManager;
  private strokeProgram: ShaderProgram | null = null;
  private currentStroke: ProcessedStrokePoint[] = [];
  private strokeBuffers: {
    position?: string;
    texCoord?: string;
    color?: string;
    pressure?: string;
    attributes?: Record<string, string>;
    index?: string;
  } = {};

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
  }

  /**
   * Initialize stroke rendering shaders
   */
  private initializeShaders(): void {
    const brushTemplate = getShaderTemplate('brush');
    this.strokeProgram = this.renderer.addShaderProgram(
      'stroke',
      brushTemplate.vertex,
      brushTemplate.fragment
    );
  }

  /**
   * Start a new stroke
   */
  public startStroke(point: StrokePoint, config: StrokeConfig): void {
    this.currentStroke = [];
    this.addStrokePoint(point, config);
  }

  /**
   * Add a point to the current stroke
   */
  public addStrokePoint(point: StrokePoint, config: StrokeConfig): void {
    const processedPoint = this.processStrokePoint(point);
    this.currentStroke.push(processedPoint);

    // Apply smoothing
    if (config.smoothing > 0 && this.currentStroke.length > 2) {
      this.applySmoothingToLastPoints(config.smoothing);
    }

    // Update stroke geometry
    this.updateStrokeGeometry(config);
  }

  /**
   * Complete the current stroke
   */
  public finishStroke(config: StrokeConfig): void {
    if (this.currentStroke.length < 2) {
      return;
    }

    // Apply final smoothing and thinning
    this.applyStrokeEnds(config);
    this.updateStrokeGeometry(config);
  }

  /**
   * Render the current stroke
   */
  public renderStroke(config: StrokeConfig): void {
    if (!this.strokeProgram || this.currentStroke.length < 2) {
      return;
    }

    const gl = this.gl;

    // Use stroke shader program
    this.strokeProgram.use();

    // Set uniforms
    const canvasDims = this.renderer.getCanvasDimensions();
    this.strokeProgram.setUniform('u_resolution', [canvasDims.width, canvasDims.height]);
    this.strokeProgram.setUniform('u_transform', [1, 0, 0, 0, 1, 0, 0, 0, 1]); // Identity matrix
    this.strokeProgram.setUniform('u_thickness', config.thickness);
    this.strokeProgram.setUniform('u_pressureScale', config.pressureSensitivity);
    this.strokeProgram.setUniform('u_color', config.color);
    this.strokeProgram.setUniform('u_opacity', config.opacity);
    this.strokeProgram.setUniform('u_feather', 0.2); // Soft stroke edges
    this.strokeProgram.setUniformInt('u_useBrushTexture', 0); // No brush texture for now

    // Bind and set up vertex attributes
    this.setupVertexAttributes();

    // Draw the stroke
    if (this.strokeBuffers.index) {
      const indexBuffer = this.bufferManager.getBufferInfo(this.strokeBuffers.index);
      if (indexBuffer) {
        this.bufferManager.bindBuffer(this.strokeBuffers.index);
        const indexCount = indexBuffer.size / 2; // Uint16Array
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
      }
    } else {
      const positionBuffer = this.bufferManager.getBufferInfo(this.strokeBuffers.position!);
      if (positionBuffer) {
        const vertexCount = positionBuffer.size / (3 * 4); // 3 floats per vertex
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);
      }
    }

    // Clean up
    this.cleanupVertexAttributes();
  }

  /**
   * Process a raw stroke point into a processed point with metadata
   */
  private processStrokePoint(point: StrokePoint): ProcessedStrokePoint {
    const processedPoint: ProcessedStrokePoint = {
      x: point.x,
      y: point.y,
      pressure: point.pressure || 0.5,
      velocity: 0,
      distance: 0
    };

    // Calculate velocity and distance from previous point
    if (this.currentStroke.length > 0) {
      const prevPoint = this.currentStroke[this.currentStroke.length - 1];
      const dx = processedPoint.x - prevPoint.x;
      const dy = processedPoint.y - prevPoint.y;
      processedPoint.distance = Math.sqrt(dx * dx + dy * dy);

      // Calculate velocity (simplified - could use timestamp for more accuracy)
      if (processedPoint.distance > 0) {
        processedPoint.velocity = Math.min(processedPoint.distance / 10, 1); // Normalize velocity
      }
    }

    return processedPoint;
  }

  /**
   * Apply smoothing to the last few points in the stroke
   */
  private applySmoothingToLastPoints(smoothing: number): void {
    if (this.currentStroke.length < 3) return;

    const len = this.currentStroke.length;
    const smoothingRange = Math.min(3, len - 1);

    for (let i = len - smoothingRange; i < len - 1; i++) {
      const prev = this.currentStroke[i - 1] || this.currentStroke[i];
      const curr = this.currentStroke[i];
      const next = this.currentStroke[i + 1] || this.currentStroke[i];

      // Apply weighted average smoothing
      const weight = smoothing * 0.5;
      curr.x = curr.x * (1 - weight) + (prev.x + next.x) * 0.5 * weight;
      curr.y = curr.y * (1 - weight) + (prev.y + next.y) * 0.5 * weight;
    }
  }

  /**
   * Apply thinning and tapering effects to stroke ends
   */
  private applyStrokeEnds(config: StrokeConfig): void {
    if (this.currentStroke.length < 2 || config.thinning === 0) return;

    const taperLength = Math.min(5, this.currentStroke.length / 4);

    // Taper start
    for (let i = 0; i < taperLength && i < this.currentStroke.length; i++) {
      const progress = i / taperLength;
      const taperFactor = 1 - config.thinning * (1 - progress);
      this.currentStroke[i].pressure *= taperFactor;
    }

    // Taper end
    for (let i = 0; i < taperLength && i < this.currentStroke.length; i++) {
      const idx = this.currentStroke.length - 1 - i;
      const progress = i / taperLength;
      const taperFactor = 1 - config.thinning * (1 - progress);
      this.currentStroke[idx].pressure *= taperFactor;
    }
  }

  /**
   * Update stroke geometry based on current stroke points
   */
  private updateStrokeGeometry(config: StrokeConfig): void {
    if (this.currentStroke.length < 2) return;

    const geometry = this.createStrokeGeometry(this.currentStroke, config);
    
    // Clean up old buffers
    this.cleanupStrokeBuffers();

    // Create new buffers
    this.strokeBuffers = this.bufferManager.createGeometryBuffers(geometry, 'stroke');
  }

  /**
   * Create triangle strip geometry for the stroke
   */
  private createStrokeGeometry(points: ProcessedStrokePoint[], config: StrokeConfig): GeometryData {
    const positions: number[] = [];
    const texCoords: number[] = [];
    const colors: number[] = [];
    const pressures: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    const [r, g, b, a] = config.color;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      let perpX = 0, perpY = 1; // Default perpendicular vector

      // Calculate perpendicular vector for line thickness
      if (i > 0 && i < points.length - 1) {
        // Use average of adjacent segments for smoother transitions
        const prev = points[i - 1];
        const next = points[i + 1];
        const dx1 = point.x - prev.x;
        const dy1 = point.y - prev.y;
        const dx2 = next.x - point.x;
        const dy2 = next.y - point.y;
        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

        if (len1 > 0 && len2 > 0) {
          const nx1 = -dy1 / len1;
          const ny1 = dx1 / len1;
          const nx2 = -dy2 / len2;
          const ny2 = dx2 / len2;
          
          perpX = (nx1 + nx2) * 0.5;
          perpY = (ny1 + ny2) * 0.5;
          
          // Normalize
          const len = Math.sqrt(perpX * perpX + perpY * perpY);
          if (len > 0) {
            perpX /= len;
            perpY /= len;
          }
        }
      } else if (i > 0) {
        // Use previous segment direction
        const prev = points[i - 1];
        const dx = point.x - prev.x;
        const dy = point.y - prev.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
          perpX = -dy / length;
          perpY = dx / length;
        }
      } else if (i < points.length - 1) {
        // Use next segment direction
        const next = points[i + 1];
        const dx = next.x - point.x;
        const dy = next.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
          perpX = -dy / length;
          perpY = dx / length;
        }
      }

      // Create two vertices per point (top and bottom of the stroke)
      const vertexIndex = i * 2;

      // Top vertex
      positions.push(point.x, point.y, 0);
      texCoords.push(0.5, 1); // Center horizontally, top vertically
      colors.push(r, g, b, a);
      pressures.push(point.pressure);
      normals.push(perpX, perpY);

      // Bottom vertex  
      positions.push(point.x, point.y, 0);
      texCoords.push(0.5, 0); // Center horizontally, bottom vertically
      colors.push(r, g, b, a);
      pressures.push(point.pressure);
      normals.push(-perpX, -perpY);

      // Add triangle indices (except for last point)
      if (i < points.length - 1) {
        // First triangle
        indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
        // Second triangle
        indices.push(vertexIndex + 1, vertexIndex + 3, vertexIndex + 2);
      }
    }

    const geometry: GeometryData = {
      positions: new Float32Array(positions),
      texCoords: new Float32Array(texCoords),
      colors: new Float32Array(colors),
      indices: new Uint16Array(indices),
      attributes: {
        pressure: new Float32Array(pressures),
        normal: new Float32Array(normals)
      }
    };

    return geometry;
  }

  /**
   * Set up vertex attributes for stroke rendering
   */
  private setupVertexAttributes(): void {
    if (!this.strokeProgram) return;

    // Position attribute
    if (this.strokeBuffers.position) {
      this.bufferManager.bindBuffer(this.strokeBuffers.position);
      this.strokeProgram.enableAttribute('a_position');
      this.strokeProgram.setAttributePointer('a_position', 3);
    }

    // Texture coordinate attribute
    if (this.strokeBuffers.texCoord) {
      this.bufferManager.bindBuffer(this.strokeBuffers.texCoord);
      this.strokeProgram.enableAttribute('a_texCoord');
      this.strokeProgram.setAttributePointer('a_texCoord', 2);
    }

    // Color attribute
    if (this.strokeBuffers.color) {
      this.bufferManager.bindBuffer(this.strokeBuffers.color);
      this.strokeProgram.enableAttribute('a_color');
      this.strokeProgram.setAttributePointer('a_color', 4);
    }

    // Pressure attribute
    if (this.strokeBuffers.attributes?.pressure) {
      this.bufferManager.bindBuffer(this.strokeBuffers.attributes.pressure);
      this.strokeProgram.enableAttribute('a_pressure');
      this.strokeProgram.setAttributePointer('a_pressure', 1);
    }

    // Normal attribute
    if (this.strokeBuffers.attributes?.normal) {
      this.bufferManager.bindBuffer(this.strokeBuffers.attributes.normal);
      this.strokeProgram.enableAttribute('a_normal');
      this.strokeProgram.setAttributePointer('a_normal', 2);
    }
  }

  /**
   * Clean up vertex attributes after rendering
   */
  private cleanupVertexAttributes(): void {
    if (!this.strokeProgram) return;

    this.strokeProgram.disableAttribute('a_position');
    this.strokeProgram.disableAttribute('a_texCoord');
    this.strokeProgram.disableAttribute('a_color');
    this.strokeProgram.disableAttribute('a_pressure');
    this.strokeProgram.disableAttribute('a_normal');
  }

  /**
   * Clean up stroke buffers
   */
  private cleanupStrokeBuffers(): void {
    for (const bufferId of Object.values(this.strokeBuffers)) {
      if (typeof bufferId === 'string' && this.bufferManager.hasBuffer(bufferId)) {
        this.bufferManager.deleteBuffer(bufferId);
      }
    }
    for (const bufferId of Object.values(this.strokeBuffers.attributes || {})) {
      if (this.bufferManager.hasBuffer(bufferId)) {
        this.bufferManager.deleteBuffer(bufferId);
      }
    }
    this.strokeBuffers = {};
  }

  /**
   * Clear the current stroke
   */
  public clearStroke(): void {
    this.currentStroke = [];
    this.cleanupStrokeBuffers();
  }

  /**
   * Get the current stroke points
   */
  public getCurrentStroke(): ProcessedStrokePoint[] {
    return [...this.currentStroke];
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.cleanupStrokeBuffers();
    this.currentStroke = [];
  }

  /**
   * Static utility to convert Canvas 2D color to WebGL color
   */
  public static parseColor(colorString: string): [number, number, number, number] {
    // Simple hex color parser (expand as needed)
    if (colorString.startsWith('#')) {
      const hex = colorString.slice(1);
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        return [r, g, b, 1];
      }
    }
    
    // Default to white if parsing fails
    return [1, 1, 1, 1];
  }
}
