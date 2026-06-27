import { test, expect } from '@playwright/test';

test.describe('WebGL Texture Debug', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('debug WebGL texture creation and copying', async ({ page }) => {
    // Capture console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
    
    // Select WebGL mode
    await page.locator('button:has-text("WebGL")').click();
    
    // Get canvas elements  
    const foldedCanvas = page.locator('canvas').first();
    
    // Draw on folded canvas to create white pixels
    await foldedCanvas.dragTo(foldedCanvas, {
      sourcePosition: { x: 100, y: 100 },
      targetPosition: { x: 150, y: 150 }
    });
    
    await page.waitForTimeout(500);
    
    // Test texture creation and copying directly in the browser
    const testResults = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Get the folded canvas
        const foldedCanvas = document.querySelectorAll('canvas')[0] as HTMLCanvasElement;
        const unfoldedCanvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
        
        // Check folded canvas content
        const foldedCtx = foldedCanvas.getContext('2d')!;
        const foldedImageData = foldedCtx.getImageData(0, 0, foldedCanvas.width, foldedCanvas.height);
        
        let foldedWhitePixels = 0;
        let foldedSamplePixels = [];
        
        for (let i = 0; i < foldedImageData.data.length; i += 4) {
          const r = foldedImageData.data[i];
          const g = foldedImageData.data[i + 1];
          const b = foldedImageData.data[i + 2];
          const a = foldedImageData.data[i + 3];
          
          if (r === 255 && g === 255 && b === 255 && a === 255) {
            foldedWhitePixels++;
            if (foldedSamplePixels.length < 3) {
              foldedSamplePixels.push({ r, g, b, a, pixel: i/4 });
            }
          }
        }
        
        // Test creating a simple WebGL texture from the folded canvas
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 100;
        testCanvas.height = 100;
        
        const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
        if (!gl) {
          resolve({ error: 'WebGL not available' });
          return;
        }
        
        // Create texture from folded canvas
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, foldedCanvas);
        
        // Set up framebuffer to read back the texture
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        
        // Read pixels from the texture
        const pixels = new Uint8Array(100 * 100 * 4);
        gl.readPixels(0, 0, 100, 100, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        
        // Analyze the texture pixels
        let textureWhitePixels = 0;
        let textureSamplePixels = [];
        
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];
          
          if (r === 255 && g === 255 && b === 255 && a === 255) {
            textureWhitePixels++;
          }
          
          // Sample some non-background pixels
          if (textureSamplePixels.length < 5 && !(r === 0 && g === 0 && b === 128)) {
            textureSamplePixels.push({ r, g, b, a, pixel: i/4 });
          }
        }
        
        // Test copying texture back to Canvas 2D
        const testCanvas2D = document.createElement('canvas');
        testCanvas2D.width = 100;
        testCanvas2D.height = 100;
        const test2DCtx = testCanvas2D.getContext('2d')!;
        
        // Copy WebGL canvas to 2D canvas
        test2DCtx.drawImage(testCanvas, 0, 0);
        
        // Analyze the copied result
        const copiedImageData = test2DCtx.getImageData(0, 0, 100, 100);
        let copiedWhitePixels = 0;
        let copiedSamplePixels = [];
        
        for (let i = 0; i < copiedImageData.data.length; i += 4) {
          const r = copiedImageData.data[i];
          const g = copiedImageData.data[i + 1];
          const b = copiedImageData.data[i + 2];
          const a = copiedImageData.data[i + 3];
          
          if (r === 255 && g === 255 && b === 255 && a === 255) {
            copiedWhitePixels++;
          }
          
          // Sample some non-background pixels
          if (copiedSamplePixels.length < 5 && !(r === 0 && g === 0 && b === 0)) {
            copiedSamplePixels.push({ r, g, b, a, pixel: i/4 });
          }
        }
        
        resolve({
          folded: { whitePixels: foldedWhitePixels, samples: foldedSamplePixels },
          webglTexture: { whitePixels: textureWhitePixels, samples: textureSamplePixels },
          canvas2DCopy: { whitePixels: copiedWhitePixels, samples: copiedSamplePixels }
        });
      });
    });
    
    console.log('Texture creation test results:', JSON.stringify(testResults, null, 2));
    
    expect(testResults).toBeDefined();
  });
});