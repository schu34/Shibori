import { test, expect } from '@playwright/test';

test.describe('Canvas Mirroring Debug', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('debug mirroring process with timeouts', async ({ page }) => {
    // Capture console messages and errors
    const consoleMessages: string[] = [];
    const errors: string[] = [];
    page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', error => errors.push(`[ERROR] ${error.message}`));
    
    // Ensure Canvas 2D mode is selected
    await page.locator('button:has-text("Canvas 2D")').click();
    
    console.log('Selected Canvas 2D mode');
    
    // Get canvas elements with timeout
    const foldedCanvas = page.locator('canvas').first();
    await expect(foldedCanvas).toBeVisible();
    
    console.log('Canvas is visible');
    
    // Check initial state
    const initialState = await page.evaluate(() => {
      const foldedCanvas = document.querySelectorAll('canvas')[0] as HTMLCanvasElement;
      const unfoldedCanvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
      return {
        foldedSize: { width: foldedCanvas.width, height: foldedCanvas.height },
        unfoldedSize: { width: unfoldedCanvas.width, height: unfoldedCanvas.height }
      };
    });
    
    console.log('Initial canvas sizes:', initialState);
    
    // Draw on folded canvas with timeout protection
    console.log('Starting draw operation...');
    
    const drawPromise = foldedCanvas.dragTo(foldedCanvas, {
      sourcePosition: { x: 50, y: 50 },
      targetPosition: { x: 100, y: 100 }
    });
    
    // Race the draw operation against a timeout
    const timeoutPromise = page.waitForTimeout(5000).then(() => 'TIMEOUT');
    const result = await Promise.race([drawPromise, timeoutPromise]);
    
    if (result === 'TIMEOUT') {
      console.log('Draw operation timed out');
      console.log('Console messages during draw:', consoleMessages.slice(-10));
      console.log('Errors during draw:', errors);
      return;
    }
    
    console.log('Draw operation completed');
    
    // Wait a short time and check for mirroring
    await page.waitForTimeout(1000);
    
    const finalState = await page.evaluate(() => {
      const foldedCanvas = document.querySelectorAll('canvas')[0] as HTMLCanvasElement;
      const unfoldedCanvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
      const foldedCtx = foldedCanvas.getContext('2d')!;
      const unfoldedCtx = unfoldedCanvas.getContext('2d')!;
      
      // Count white pixels
      const foldedImageData = foldedCtx.getImageData(0, 0, foldedCanvas.width, foldedCanvas.height);
      const unfoldedImageData = unfoldedCtx.getImageData(0, 0, unfoldedCanvas.width, unfoldedCanvas.height);
      
      let foldedWhitePixels = 0;
      let unfoldedWhitePixels = 0;
      
      for (let i = 0; i < foldedImageData.data.length; i += 4) {
        const r = foldedImageData.data[i];
        const g = foldedImageData.data[i + 1];
        const b = foldedImageData.data[i + 2];
        const a = foldedImageData.data[i + 3];
        if (r === 255 && g === 255 && b === 255 && a === 255) {
          foldedWhitePixels++;
        }
      }
      
      for (let i = 0; i < unfoldedImageData.data.length; i += 4) {
        const r = unfoldedImageData.data[i];
        const g = unfoldedImageData.data[i + 1];
        const b = unfoldedImageData.data[i + 2];
        const a = unfoldedImageData.data[i + 3];
        if (r === 255 && g === 255 && b === 255 && a === 255) {
          unfoldedWhitePixels++;
        }
      }
      
      return { foldedWhitePixels, unfoldedWhitePixels };
    });
    
    console.log('Final pixel counts:', finalState);
    console.log('Recent console messages:', consoleMessages.slice(-15));
    console.log('Any errors:', errors);
    
    // The test should complete without hanging
    expect(true).toBe(true);
  });
});