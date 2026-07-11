/**
 * E2E tests for WebGL drawing pipeline
 * Tests mode selection, drawing functionality, and mirroring behavior
 */

import { test, expect } from '@playwright/test';
import { analyzeCanvasPixels, drawOnCanvas } from './utils/canvasHelpers';

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

    test('should reflect the project-requested startup backend', async ({ page }, testInfo) => {
      const expectedMode = testInfo.project.name === 'chromium-canvas2d'
        ? 'canvas2d'
        : 'webgl';
      const expectedButtonName = expectedMode === 'canvas2d' ? 'Canvas 2D' : 'WebGL';

      await expect(page.locator('html')).toHaveAttribute('data-shibori-renderer-requested', expectedMode);
      await expect(page.getByRole('button', { name: expectedButtonName, exact: true })).toHaveClass(/active/);
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
      const foldedCanvas = page.getByLabel('Folded drawing canvas');
      const unfoldedCanvas = page.locator('.canvas-container canvas').nth(1);
      
      // Verify canvases exist
      await expect(foldedCanvas).toBeVisible();
      await expect(unfoldedCanvas).toBeVisible();
      
      const initialFolded = await analyzeCanvasPixels(page, 0);
      const initialUnfolded = await analyzeCanvasPixels(page, 1);
      
      console.log(`Initial pixels - Folded: ${initialFolded.pixelCounts.white}, Unfolded: ${initialUnfolded.pixelCounts.white}`);
      
      // Draw on folded canvas
      await drawOnCanvas(foldedCanvas, {
        startOffset: { x: -50, y: -50 },
        endOffset: { x: 50, y: 50 }
      });
      
      // Wait for processing
      await page.waitForTimeout(200);
      
      const finalFolded = await analyzeCanvasPixels(page, 0);
      const finalUnfolded = await analyzeCanvasPixels(page, 1);
      const foldedDelta = finalFolded.pixelCounts.white - initialFolded.pixelCounts.white;
      const unfoldedDelta = finalUnfolded.pixelCounts.white - initialUnfolded.pixelCounts.white;
      
      console.log(`Final pixels - Folded: ${finalFolded.pixelCounts.white}, Unfolded: ${finalUnfolded.pixelCounts.white}`);
      
      // Verify drawing occurred
      expect(foldedDelta).toBeGreaterThan(100);
      expect(unfoldedDelta).toBeGreaterThan(100);
      
      // Verify mirroring (unfolded should have more pixels due to symmetry)
      expect(finalUnfolded.pixelCounts.white).toBeGreaterThan(finalFolded.pixelCounts.white);
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
        const foldedCanvas = page.getByLabel('Folded drawing canvas');
        
        const initialUnfolded = await analyzeCanvasPixels(page, 1);
        
        // Draw on folded canvas
        await drawOnCanvas(foldedCanvas, {
          startOffset: { x: -50, y: -50 },
          endOffset: { x: 50, y: 50 }
        });
        
        // Wait for processing
        await page.waitForTimeout(500);
        
        const finalUnfolded = await analyzeCanvasPixels(page, 1);
        const unfoldedDelta = finalUnfolded.pixelCounts.white - initialUnfolded.pixelCounts.white;
        
        console.log('WebGL mode console messages:', consoleMessages);
        console.log(`WebGL mode pixels - Initial: ${initialUnfolded.pixelCounts.white}, Final: ${finalUnfolded.pixelCounts.white}`);
        
        // Should still have drawing functionality regardless of mode
        expect(unfoldedDelta).toBeGreaterThan(100);
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
      const foldedCanvas = page.getByLabel('Folded drawing canvas');
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
