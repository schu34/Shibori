import { test, expect } from '@playwright/test';

test.describe('Canvas Drawing Debug', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('debug canvas pixel data and drawing', async ({ page }) => {
    // Ensure Canvas 2D mode is selected
    await page.locator('button:has-text("Canvas 2D")').click();
    
    // Get canvas elements
    const foldedCanvas = page.locator('canvas').first();
    
    // Check initial canvas state
    const initialDebugInfo = await page.evaluate(() => {
      const canvas = document.querySelectorAll('canvas')[0] as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Sample first 20 pixels to see what's there
      const samplePixels = [];
      for (let i = 0; i < 80; i += 4) {
        samplePixels.push({
          r: imageData.data[i],
          g: imageData.data[i+1], 
          b: imageData.data[i+2],
          a: imageData.data[i+3]
        });
      }
      
      // Count different types of pixels
      let transparentPixels = 0;
      let whitePixels = 0;
      let coloredPixels = 0;
      
      for (let i = 0; i < imageData.data.length; i += 4) {
        const a = imageData.data[i + 3];
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        
        if (a === 0) {
          transparentPixels++;
        } else if (r === 255 && g === 255 && b === 255) {
          whitePixels++;
        } else if (a > 0) {
          coloredPixels++;
        }
      }
      
      return {
        canvasDimensions: { width: canvas.width, height: canvas.height },
        samplePixels: samplePixels.slice(0, 5),
        pixelCounts: { transparent: transparentPixels, white: whitePixels, colored: coloredPixels },
        totalPixels: imageData.data.length / 4
      };
    });
    
    console.log('Initial canvas state:', JSON.stringify(initialDebugInfo, null, 2));
    
    // Draw on folded canvas
    await foldedCanvas.dragTo(foldedCanvas, {
      sourcePosition: { x: 50, y: 50 },
      targetPosition: { x: 100, y: 100 }
    });
    
    // Wait for processing
    await page.waitForTimeout(500);
    
    // Check final canvas state
    const finalDebugInfo = await page.evaluate(() => {
      const canvas = document.querySelectorAll('canvas')[0] as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Sample around the drawing area (50,50 to 100,100)
      const drawingAreaSamples = [];
      for (let y = 45; y < 105; y += 10) {
        for (let x = 45; x < 105; x += 10) {
          const idx = (y * canvas.width + x) * 4;
          drawingAreaSamples.push({
            x, y,
            r: imageData.data[idx],
            g: imageData.data[idx+1], 
            b: imageData.data[idx+2],
            a: imageData.data[idx+3]
          });
        }
      }
      
      // Count different types of pixels
      let transparentPixels = 0;
      let whitePixels = 0;
      let coloredPixels = 0;
      
      for (let i = 0; i < imageData.data.length; i += 4) {
        const a = imageData.data[i + 3];
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        
        if (a === 0) {
          transparentPixels++;
        } else if (r === 255 && g === 255 && b === 255) {
          whitePixels++;
        } else if (a > 0) {
          coloredPixels++;
        }
      }
      
      return {
        drawingAreaSamples: drawingAreaSamples.slice(0, 10),
        pixelCounts: { transparent: transparentPixels, white: whitePixels, colored: coloredPixels },
        totalPixels: imageData.data.length / 4
      };
    });
    
    console.log('Final canvas state:', JSON.stringify(finalDebugInfo, null, 2));
    
    // Compare counts
    const transparentDiff = initialDebugInfo.pixelCounts.transparent - finalDebugInfo.pixelCounts.transparent;
    const whiteDiff = finalDebugInfo.pixelCounts.white - initialDebugInfo.pixelCounts.white;
    const coloredDiff = finalDebugInfo.pixelCounts.colored - initialDebugInfo.pixelCounts.colored;
    
    console.log('Pixel differences:', { transparentDiff, whiteDiff, coloredDiff });
    
    // The drawing should have changed something
    expect(Math.abs(transparentDiff) + Math.abs(whiteDiff) + Math.abs(coloredDiff)).toBeGreaterThan(0);
  });
});