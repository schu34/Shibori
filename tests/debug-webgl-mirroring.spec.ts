import { test, expect } from '@playwright/test';

test.describe('WebGL Mirroring Debug', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('debug WebGL mirroring pixel output', async ({ page }) => {
    // Capture console messages and errors
    const consoleMessages: string[] = [];
    const errors: string[] = [];
    page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', error => errors.push(`[ERROR] ${error.message}`));
    
    // Select WebGL mode explicitly
    await page.locator('button:has-text("WebGL")').click();
    await page.waitForTimeout(100);
    
    console.log('Selected WebGL mode');
    
    // Get canvas elements
    const foldedCanvas = page.locator('canvas').first();
    const unfoldedCanvas = page.locator('canvas').last();
    
    // Check initial state
    const initialState = await page.evaluate(() => {
      const foldedCanvas = document.querySelectorAll('canvas')[0] as HTMLCanvasElement;
      const unfoldedCanvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
      
      const foldedCtx = foldedCanvas.getContext('2d')!;
      const unfoldedCtx = unfoldedCanvas.getContext('2d')!;
      
      // Count different types of pixels
      const countPixels = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let white = 0, colored = 0, transparent = 0;
        
        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const a = imageData.data[i + 3];
          
          if (a === 0) {
            transparent++;
          } else if (r === 255 && g === 255 && b === 255) {
            white++;
          } else {
            colored++;
          }
        }
        
        return { white, colored, transparent };
      };
      
      return {
        folded: countPixels(foldedCtx, foldedCanvas),
        unfolded: countPixels(unfoldedCtx, unfoldedCanvas)
      };
    });
    
    console.log('Initial pixel counts:', initialState);
    
    // Draw on folded canvas
    console.log('Drawing on folded canvas...');
    await foldedCanvas.dragTo(foldedCanvas, {
      sourcePosition: { x: 50, y: 50 },
      targetPosition: { x: 100, y: 100 }
    });
    
    // Wait for WebGL processing
    await page.waitForTimeout(1000);
    
    // Check final state with detailed analysis
    const finalState = await page.evaluate(() => {
      const foldedCanvas = document.querySelectorAll('canvas')[0] as HTMLCanvasElement;
      const unfoldedCanvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
      
      const foldedCtx = foldedCanvas.getContext('2d')!;
      const unfoldedCtx = unfoldedCanvas.getContext('2d')!;
      
      // Count different types of pixels
      const countPixels = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, name: string) => {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let white = 0, colored = 0, transparent = 0;
        const samplePixels = [];
        
        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const a = imageData.data[i + 3];
          
          // Sample some pixels for debugging
          if (samplePixels.length < 5 && (r !== 0 || g !== 0 || b !== 128 || a !== 255)) {
            samplePixels.push({ r, g, b, a, pixelIndex: i/4 });
          }
          
          if (a === 0) {
            transparent++;
          } else if (r === 255 && g === 255 && b === 255) {
            white++;
          } else {
            colored++;
          }
        }
        
        return { white, colored, transparent, samplePixels, name };
      };
      
      const foldedPixels = countPixels(foldedCtx, foldedCanvas, 'folded');
      const unfoldedPixels = countPixels(unfoldedCtx, unfoldedCanvas, 'unfolded');
      
      // Check a specific region of the unfolded canvas
      const regionCheck = unfoldedCtx.getImageData(50, 50, 100, 100);
      let regionWhitePixels = 0;
      for (let i = 0; i < regionCheck.data.length; i += 4) {
        const r = regionCheck.data[i];
        const g = regionCheck.data[i + 1];
        const b = regionCheck.data[i + 2];
        const a = regionCheck.data[i + 3];
        if (r === 255 && g === 255 && b === 255 && a === 255) {
          regionWhitePixels++;
        }
      }
      
      return {
        folded: foldedPixels,
        unfolded: unfoldedPixels,
        unfoldedRegionWhitePixels: regionWhitePixels
      };
    });
    
    console.log('Final pixel counts:', JSON.stringify(finalState, null, 2));
    
    // Filter WebGL-related console messages
    const webglMessages = consoleMessages.filter(msg => 
      msg.includes('WebGL') || 
      msg.includes('updateUnfoldedCanvasWebGL') ||
      msg.includes('WebGLCanvasService') ||
      msg.includes('Copying') ||
      msg.includes('texture') ||
      msg.includes('pixels')
    );
    
    console.log('WebGL-related console messages:', webglMessages.slice(-10));
    console.log('Any errors:', errors);
    
    // The test should pass if drawing worked (folded canvas has white pixels)
    expect(finalState.folded.white).toBeGreaterThan(0);
    
    // This should pass if WebGL mirroring worked (unfolded canvas should have white pixels)
    if (finalState.unfolded.white === 0) {
      console.log('❌ CRITICAL: WebGL mirroring failed - unfolded canvas has no white pixels');
      console.log('Folded canvas white pixels:', finalState.folded.white);
      console.log('Unfolded canvas white pixels:', finalState.unfolded.white);
    } else {
      console.log('✅ WebGL mirroring working - unfolded canvas has white pixels');
    }
  });
});