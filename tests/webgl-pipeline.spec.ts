/**
 * E2E tests for WebGL drawing pipeline
 * Tests mode selection, drawing functionality, and mirroring behavior
 */

import { test, expect } from '@playwright/test';

test.describe('WebGL Drawing Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Mode Selection UI', () => {
    test('should show rendering mode controls', async ({ page }) => {
      // Check if WebGL controls are visible
      await expect(page.locator('text=Rendering')).toBeVisible();
      await expect(page.locator('button:has-text("Auto")')).toBeVisible();
      await expect(page.locator('button:has-text("WebGL")')).toBeVisible();
      await expect(page.locator('button:has-text("Canvas 2D")')).toBeVisible();
    });

    test('should start with Auto mode selected', async ({ page }) => {
      const autoButton = page.locator('button:has-text("Auto")');
      await expect(autoButton).toHaveClass(/active/);
    });

    test('should allow switching to WebGL mode', async ({ page }) => {
      const webglButton = page.locator('button:has-text("WebGL")');
      
      // Check if WebGL button is enabled (if WebGL is available)
      const isEnabled = await webglButton.isEnabled();
      if (isEnabled) {
        await webglButton.click();
        await expect(webglButton).toHaveClass(/active/);
        
        // Verify mode change in console logs
        const logs: string[] = [];
        page.on('console', msg => logs.push(msg.text()));
        
        // Wait a bit for any console messages
        await page.waitForTimeout(100);
        
        // Should see some indication of WebGL mode
        console.log('Console logs after WebGL selection:', logs);
      } else {
        console.log('WebGL not available in test environment');
      }
    });

    test('should allow switching to Canvas 2D mode', async ({ page }) => {
      const canvas2dButton = page.locator('button:has-text("Canvas 2D")');
      await canvas2dButton.click();
      await expect(canvas2dButton).toHaveClass(/active/);
    });
  });

  test.describe('Drawing with Different Modes', () => {
    test('should draw and mirror in Canvas 2D mode', async ({ page }) => {
      // Ensure Canvas 2D mode is selected
      await page.locator('button:has-text("Canvas 2D")').click();
      
      // Get canvas elements
      const foldedCanvas = page.locator('canvas').first();
      const unfoldedCanvas = page.locator('canvas').last();
      
      // Verify canvases exist
      await expect(foldedCanvas).toBeVisible();
      await expect(unfoldedCanvas).toBeVisible();
      
      // Get initial pixel counts (count white pixels since drawing color is white)
      const initialFoldedPixels = await page.evaluate(() => {
        const canvas = document.querySelectorAll('canvas')[0] as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let whitePixels = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const a = imageData.data[i + 3];
          if (r === 255 && g === 255 && b === 255 && a === 255) {
            whitePixels++;
          }
        }
        return whitePixels;
      });
      
      const initialUnfoldedPixels = await page.evaluate(() => {
        const canvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let whitePixels = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const a = imageData.data[i + 3];
          if (r === 255 && g === 255 && b === 255 && a === 255) {
            whitePixels++;
          }
        }
        return whitePixels;
      });
      
      console.log(`Initial pixels - Folded: ${initialFoldedPixels}, Unfolded: ${initialUnfoldedPixels}`);
      
      // Draw on folded canvas
      await foldedCanvas.dragTo(foldedCanvas, {
        sourcePosition: { x: 50, y: 50 },
        targetPosition: { x: 100, y: 100 }
      });
      
      // Wait for processing
      await page.waitForTimeout(200);
      
      // Get final pixel counts (count white pixels since drawing color is white)
      const finalFoldedPixels = await page.evaluate(() => {
        const canvas = document.querySelectorAll('canvas')[0] as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let whitePixels = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const a = imageData.data[i + 3];
          if (r === 255 && g === 255 && b === 255 && a === 255) {
            whitePixels++;
          }
        }
        return whitePixels;
      });
      
      const finalUnfoldedPixels = await page.evaluate(() => {
        const canvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let whitePixels = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const a = imageData.data[i + 3];
          if (r === 255 && g === 255 && b === 255 && a === 255) {
            whitePixels++;
          }
        }
        return whitePixels;
      });
      
      console.log(`Final pixels - Folded: ${finalFoldedPixels}, Unfolded: ${finalUnfoldedPixels}`);
      
      // Verify drawing occurred
      expect(finalFoldedPixels).toBeGreaterThan(initialFoldedPixels);
      expect(finalUnfoldedPixels).toBeGreaterThan(initialUnfoldedPixels);
      
      // Verify mirroring (unfolded should have more pixels due to symmetry)
      expect(finalUnfoldedPixels).toBeGreaterThan(finalFoldedPixels);
    });

    test('should handle WebGL mode gracefully', async ({ page }) => {
      // Capture console messages
      const consoleMessages: string[] = [];
      page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
      
      // Try to select WebGL mode
      const webglButton = page.locator('button:has-text("WebGL")');
      const isWebGLEnabled = await webglButton.isEnabled();
      
      if (isWebGLEnabled) {
        await webglButton.click();
        
        // Get canvas elements
        const foldedCanvas = page.locator('canvas').first();
        const unfoldedCanvas = page.locator('canvas').last();
        
        // Get initial pixel counts (count white pixels since drawing color is white)
        const initialUnfoldedPixels = await page.evaluate(() => {
          const canvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
          const ctx = canvas.getContext('2d')!;
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let whitePixels = 0;
          for (let i = 0; i < imageData.data.length; i += 4) {
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];
            const a = imageData.data[i + 3];
            if (r === 255 && g === 255 && b === 255 && a === 255) {
              whitePixels++;
            }
          }
          return whitePixels;
        });
        
        // Draw on folded canvas
        await foldedCanvas.dragTo(foldedCanvas, {
          sourcePosition: { x: 50, y: 50 },
          targetPosition: { x: 100, y: 100 }
        });
        
        // Wait for processing
        await page.waitForTimeout(500);
        
        // Get final pixel counts (count white pixels since drawing color is white)
        const finalUnfoldedPixels = await page.evaluate(() => {
          const canvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
          const ctx = canvas.getContext('2d')!;
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let whitePixels = 0;
          for (let i = 0; i < imageData.data.length; i += 4) {
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];
            const a = imageData.data[i + 3];
            if (r === 255 && g === 255 && b === 255 && a === 255) {
              whitePixels++;
            }
          }
          return whitePixels;
        });
        
        console.log('WebGL mode console messages:', consoleMessages);
        console.log(`WebGL mode pixels - Initial: ${initialUnfoldedPixels}, Final: ${finalUnfoldedPixels}`);
        
        // Either WebGL works or it falls back to Canvas 2D
        const hasWebGLSuccess = consoleMessages.some(msg => msg.includes('WebGL update successful'));
        const hasWebGLFallback = consoleMessages.some(msg => msg.includes('falling back to Canvas 2D') || msg.includes('Using Canvas 2D'));
        
        expect(hasWebGLSuccess || hasWebGLFallback).toBe(true);
        
        // Should still have drawing functionality regardless of mode
        expect(finalUnfoldedPixels).toBeGreaterThan(initialUnfoldedPixels);
      } else {
        console.log('WebGL not available in test environment, skipping WebGL-specific tests');
      }
    });
  });

  test.describe('WebGL Status Display', () => {
    test('should show WebGL status information', async ({ page }) => {
      // Look for WebGL status indicators
      const webglStatus = page.locator('.webgl-status');
      if (await webglStatus.isVisible()) {
        await expect(webglStatus).toBeVisible();
        
        // Should show either "Available", "Failed", or "Canvas 2D Only"
        const statusText = await webglStatus.textContent();
        expect(statusText).toMatch(/(Available|Failed|Canvas 2D)/);
      }
    });

    test('should show WebGL details when expanded', async ({ page }) => {
      // Look for details toggle button
      const detailsButton = page.locator('button[title*="details"]');
      if (await detailsButton.isVisible()) {
        await detailsButton.click();
        
        // Should show additional WebGL information
        await expect(page.locator('text=Debug Information')).toBeVisible();
      }
    });
  });

  test.describe('Mode Persistence', () => {
    test('should remember selected mode across page interactions', async ({ page }) => {
      // Select Canvas 2D mode
      await page.locator('button:has-text("Canvas 2D")').click();
      
      // Perform some drawing
      const foldedCanvas = page.locator('canvas').first();
      await foldedCanvas.dragTo(foldedCanvas, {
        sourcePosition: { x: 30, y: 30 },
        targetPosition: { x: 60, y: 60 }
      });
      
      // Mode should still be selected
      await expect(page.locator('button:has-text("Canvas 2D")')).toHaveClass(/active/);
      
      // Change fold settings
      await page.locator('button:has-text("2")').first().click(); // Increase vertical folds
      
      // Mode should still be selected
      await expect(page.locator('button:has-text("Canvas 2D")')).toHaveClass(/active/);
    });
  });
});