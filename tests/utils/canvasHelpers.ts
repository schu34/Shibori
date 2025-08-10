import { Page, Locator } from '@playwright/test';

/**
 * Canvas testing utilities for verifying drawing operations
 */

export interface PixelCounts {
  total: number;
  white: number;
  navy: number;
  other: number;
}

export interface CanvasAnalysis {
  pixelCounts: PixelCounts;
  hasDrawing: boolean;
  drawingDensity: number; // percentage of canvas that has drawing
}

/**
 * Count pixels by color in a canvas
 * @param page Playwright page
 * @param canvasIndex Which canvas to analyze (0 = folded, 1 = unfolded)
 * @returns Pixel count breakdown
 */
export async function analyzeCanvasPixels(page: Page, canvasIndex: number = 0): Promise<CanvasAnalysis> {
  return await page.evaluate((index) => {
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

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Check if pixel is close to white (drawing color)
      if (r > 240 && g > 240 && b > 240) {
        whitePixels++;
      }
      // Check if pixel is close to navy (background color)
      else if (r < 50 && g < 50 && b > 100) {
        navyPixels++;
      }
      // Everything else
      else {
        otherPixels++;
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
 */
export async function getWhitePixelCount(page: Page, canvasIndex: number = 0): Promise<number> {
  return await page.evaluate((index) => {
    const canvas = document.querySelectorAll('canvas')[index] as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      
      if (r > 240 && g > 240 && b > 240) {
        count++;
      }
    }
    
    return count;
  }, canvasIndex);
}

/**
 * Compare canvas states before and after an operation
 */
export interface CanvasComparison {
  before: CanvasAnalysis;
  after: CanvasAnalysis;
  whitePixelsDelta: number;
  drawingOccurred: boolean;
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
export async function selectDrawingTool(page: Page, tool: 'paintbrush' | 'line'): Promise<void> {
  await page.locator(`input[value="${tool}"]`).check();
  
  // Verify selection worked
  const isSelected = await page.locator(`input[value="${tool}"]`).isChecked();
  if (!isSelected) {
    throw new Error(`Failed to select ${tool} tool`);
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