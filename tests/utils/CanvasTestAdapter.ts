export interface PixelCounts {
  total: number;
  white: number;
  navy: number;
  other: number;
}

export interface CanvasAnalysis {
  pixelCounts: PixelCounts;
  hasDrawing: boolean;
  drawingDensity: number;
}

export interface CanvasComparison {
  before: CanvasAnalysis;
  after: CanvasAnalysis;
  whitePixelsDelta: number;
  drawingOccurred: boolean;
}
