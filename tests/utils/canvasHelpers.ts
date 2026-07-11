import { Page, Locator } from '@playwright/test';

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

/**
 * Canvas testing utilities for verifying visible drawing operations.
 */

/**
 * Count pixels by color in a visible canvas.
 * @param page Playwright page
 * @param canvasIndex Which canvas to analyze (0 = folded, 1 = unfolded)
 * @returns Pixel count breakdown
 */
export async function analyzeCanvasPixels(page: Page, canvasIndex: number = 0): Promise<CanvasAnalysis> {
  return await page.evaluate(async (index) => {
    const canvas = document.querySelectorAll('canvas')[index] as HTMLCanvasElement;
    
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      return {
        pixelCounts: { total: 0, white: 0, navy: 0, other: 0 },
        hasDrawing: false,
        drawingDensity: 0
      };
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let whitePixels = 0;
    let navyPixels = 0;
    let otherPixels = 0;
    const totalPixels = data.length / 4;

    const classifyPixel = (r: number, g: number, b: number): 'white' | 'navy' | 'other' => {
      if (r > 240 && g > 240 && b > 240) return 'white';
      if (r < 50 && g < 50 && b > 100) return 'navy';
      return 'other';
    };

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const pixelType = classifyPixel(r, g, b);
      switch (pixelType) {
        case 'white':
          whitePixels++;
          break;
        case 'navy':
          navyPixels++;
          break;
        case 'other':
          otherPixels++;
          break;
      }
    }

    const pixelCounts = {
      total: totalPixels,
      white: whitePixels,
      navy: navyPixels,
      other: otherPixels
    };

    return {
      pixelCounts,
      hasDrawing: whitePixels > 0,
      drawingDensity: (whitePixels / totalPixels) * 100
    };
  }, canvasIndex);
}

/**
 * Get just the white pixel count for a canvas (optimized for simple checks)
 * The app presents final output through visible Canvas 2D canvases.
 */
export async function getWhitePixelCount(page: Page, canvasIndex: number = 0): Promise<number> {
  return await page.evaluate((index) => {
    const canvas = document.querySelectorAll('canvas')[index] as HTMLCanvasElement;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    
    const isWhitePixel = (r: number, g: number, b: number): boolean => {
      return r > 240 && g > 240 && b > 240;
    };
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      
      if (isWhitePixel(r, g, b)) {
        count++;
      }
    }
    
    return count;
  }, canvasIndex);
}

/**
 * Perform a drawing operation and compare before/after canvas states
 * @param page Playwright page
 * @param drawingOperation Function that performs the drawing
 * @param canvasIndex Which canvas to analyze (0 = folded, 1 = unfolded)
 */
export async function compareCanvasBeforeAfterDrawing(
  page: Page,
  drawingOperation: () => Promise<void>,
  canvasIndex: number = 0
): Promise<CanvasComparison> {
  // Get before state
  const before = await analyzeCanvasPixels(page, canvasIndex);
  
  // Perform drawing
  await drawingOperation();
  
  // Wait for canvas to update
  await page.waitForTimeout(500);
  
  // Get after state
  const after = await analyzeCanvasPixels(page, canvasIndex);
  
  const whitePixelsDelta = after.pixelCounts.white - before.pixelCounts.white;
  
  return {
    before,
    after,
    whitePixelsDelta,
    drawingOccurred: whitePixelsDelta > 0
  };
}

/**
 * Perform a drawing drag operation on a canvas
 */
export async function drawOnCanvas(
  canvas: Locator,
  options: {
    startOffset?: { x: number; y: number };
    endOffset?: { x: number; y: number };
  } = {}
): Promise<void> {
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('Canvas not found');

  const centerX = canvasBox.width / 2;
  const centerY = canvasBox.height / 2;

  const startOffset = options.startOffset || { x: -30, y: -30 };
  const endOffset = options.endOffset || { x: 30, y: 30 };

  await canvas.dragTo(canvas, {
    sourcePosition: { 
      x: centerX + startOffset.x, 
      y: centerY + startOffset.y 
    },
    targetPosition: { 
      x: centerX + endOffset.x, 
      y: centerY + endOffset.y 
    }
  });
}

/**
 * Ensure a drawing tool is selected
 */
export async function selectDrawingTool(
  page: Page,
  tool: 'paintbrush' | 'line' | 'rectangle' | 'square' | 'circle' | 'selectMove'
): Promise<void> {
  const toolInput = page.locator(`input[value="${tool}"]`);
  await toolInput.check();
  
  // Verify selection worked
  const isSelected = await toolInput.isChecked();
  if (!isSelected) {
    throw new Error(`Failed to select ${tool} tool`);
  }
}

export async function selectShapeFillMode(
  page: Page,
  fillMode: 'filled' | 'outline'
): Promise<void> {
  const fillModeInput = page.locator(`input[name="shapeFillMode"][value="${fillMode}"]`);
  await fillModeInput.check();

  const isSelected = await fillModeInput.isChecked();
  if (!isSelected) {
    throw new Error(`Failed to select ${fillMode} fill mode`);
  }
}

/**
 * Get drawing tool selection state
 */
export async function getToolSelection(page: Page): Promise<{
  paintbrushSelected: boolean;
  lineSelected: boolean;
}> {
  return await page.evaluate(() => {
    const paintbrush = document.querySelector('input[value="paintbrush"]') as HTMLInputElement;
    const line = document.querySelector('input[value="line"]') as HTMLInputElement;
    
    return {
      paintbrushSelected: paintbrush?.checked || false,
      lineSelected: line?.checked || false
    };
  });
}
