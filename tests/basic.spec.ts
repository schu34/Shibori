import { test, expect } from '@playwright/test';
import { 
  analyzeCanvasPixels, 
  compareCanvasBeforeAfterDrawing, 
  drawOnCanvas, 
  getWhitePixelCount,
  selectDrawingTool,
  selectShapeFillMode
} from './utils/canvasHelpers';

test.describe('Shibori Canvas App', () => {
  test('loads app and shows canvas elements', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for the app to load
    await expect(page.locator('h1')).toContainText('Shibori Folding');

    // Check that both canvas elements are present
    const canvases = page.locator('canvas');
    await expect(canvases).toHaveCount(2);

    // Check that the main sections are visible
    await expect(page.getByRole('heading', { name: 'Folded Version', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Unfolded Version', exact: true })).toBeVisible();

    // Check that controls are present
    await expect(page.locator('text=Controls')).toBeVisible();
  });

  test('can expand and collapse controls', async ({ page }) => {
    await page.goto('/');

    // Find the controls toggle button
    const controlsToggle = page.locator('button', { hasText: 'Controls' });
    await expect(controlsToggle).toBeVisible();

    // Check that controls are initially expanded (should see fold controls)
    await expect(page.locator('text=Vertical Folds')).toBeVisible();

    // Click to collapse controls
    await controlsToggle.click();

    // Controls should now be hidden
    await expect(page.locator('text=Vertical Folds')).not.toBeVisible();

    // Click to expand controls again
    await controlsToggle.click();

    // Controls should be visible again
    await expect(page.locator('text=Vertical Folds')).toBeVisible();
  });

  test('shows canvas with proper dimensions', async ({ page }) => {
    await page.goto('/');

    // Wait for canvases to be rendered
    const foldedCanvas = page.locator('canvas').first();
    const unfoldedCanvas = page.locator('canvas').nth(1);

    await expect(foldedCanvas).toBeVisible();
    await expect(unfoldedCanvas).toBeVisible();

    // Check that canvases have some dimensions (not 0x0)
    const foldedRect = await foldedCanvas.boundingBox();
    const unfoldedRect = await unfoldedCanvas.boundingBox();

    expect(foldedRect?.width).toBeGreaterThan(0);
    expect(foldedRect?.height).toBeGreaterThan(0);
    expect(unfoldedRect?.width).toBeGreaterThan(0);
    expect(unfoldedRect?.height).toBeGreaterThan(0);
  });

  test('can draw on the folded canvas', async ({ page }) => {
    await page.goto('/');

    const foldedCanvas = page.locator('canvas').first();
    await expect(foldedCanvas).toBeVisible();

    // Ensure paintbrush tool is selected
    await selectDrawingTool(page, 'paintbrush');

    // Use the utility function to compare before/after states
    const comparison = await compareCanvasBeforeAfterDrawing(
      page,
      async () => {
        await drawOnCanvas(foldedCanvas, {
          startOffset: { x: -30, y: -30 },
          endOffset: { x: 30, y: 30 }
        });
      },
      0 // folded canvas index
    );

    // Log detailed analysis
    console.log(`Canvas analysis:
      Before drawing: ${comparison.before.pixelCounts.white} white pixels
      After drawing: ${comparison.after.pixelCounts.white} white pixels  
      Delta: +${comparison.whitePixelsDelta} white pixels
      Drawing density: ${comparison.after.drawingDensity.toFixed(2)}%`);

    // Assert that drawing actually occurred
    expect(comparison.drawingOccurred).toBe(true);
    expect(comparison.whitePixelsDelta).toBeGreaterThan(0);

    // Should have substantial drawing (more than just a few pixels)
    expect(comparison.after.pixelCounts.white).toBeGreaterThan(100);

    // Check that the undo button is enabled
    const undoButton = page.locator('button', { hasText: 'Undo' });
    await expect(undoButton).toBeEnabled();
  });

  test('drawing updates both folded and unfolded canvas', async ({ page }) => {
    await page.goto('/');

    const foldedCanvas = page.locator('canvas').first();
    const unfoldedCanvas = page.locator('canvas').nth(1);

    await expect(foldedCanvas).toBeVisible();
    await expect(unfoldedCanvas).toBeVisible();

    // Ensure paintbrush is selected
    await selectDrawingTool(page, 'paintbrush');

    // Get before state for both canvases
    const foldedBefore = await analyzeCanvasPixels(page, 0);
    const unfoldedBefore = await analyzeCanvasPixels(page, 1);

    // Draw on folded canvas
    await drawOnCanvas(foldedCanvas, {
      startOffset: { x: -50, y: -50 },
      endOffset: { x: 50, y: 50 }
    });

    await page.waitForTimeout(500);

    // Get after state for both canvases  
    const foldedAfter = await analyzeCanvasPixels(page, 0);
    const unfoldedAfter = await analyzeCanvasPixels(page, 1);

    // Calculate deltas
    const foldedDelta = foldedAfter.pixelCounts.white - foldedBefore.pixelCounts.white;
    const unfoldedDelta = unfoldedAfter.pixelCounts.white - unfoldedBefore.pixelCounts.white;

    console.log(`Canvas mirroring analysis:
      Folded canvas: ${foldedBefore.pixelCounts.white} → ${foldedAfter.pixelCounts.white} (+${foldedDelta})
      Unfolded canvas: ${unfoldedBefore.pixelCounts.white} → ${unfoldedAfter.pixelCounts.white} (+${unfoldedDelta})
      Folded density: ${foldedAfter.drawingDensity.toFixed(2)}%
      Unfolded density: ${unfoldedAfter.drawingDensity.toFixed(2)}%`);

    // Both canvases should have gained white pixels (drawing occurred)
    expect(foldedDelta).toBeGreaterThan(0);
    expect(unfoldedDelta).toBeGreaterThan(0);

    // Unfolded should have significantly more pixels due to mirroring
    expect(unfoldedAfter.pixelCounts.white).toBeGreaterThan(foldedAfter.pixelCounts.white);

    // Both should have substantial drawing
    expect(foldedAfter.pixelCounts.white).toBeGreaterThan(100);
    expect(unfoldedAfter.pixelCounts.white).toBeGreaterThan(200);

    // Test undo functionality
    const undoButton = page.locator('button', { hasText: 'Undo' });
    await expect(undoButton).toBeEnabled();
    
    await undoButton.click();
    await page.waitForTimeout(500);

    // Verify canvases are still functional after undo
    await expect(foldedCanvas).toBeVisible();
    await expect(unfoldedCanvas).toBeVisible();
  });

  test('clear is undoable without letting later undo replay pre-clear drawing', async ({ page }) => {
    await page.goto('/');

    const foldedCanvas = page.locator('canvas').first();
    const clearButton = page.getByRole('button', { name: 'Clear' });
    const undoButton = page.getByRole('button', { name: 'Undo' });

    await expect(foldedCanvas).toBeVisible();
    await selectDrawingTool(page, 'paintbrush');

    const initialUnfoldedWhite = await getWhitePixelCount(page, 1);

    await drawOnCanvas(foldedCanvas, {
      startOffset: { x: -60, y: -20 },
      endOffset: { x: 30, y: 70 }
    });
    await page.waitForTimeout(500);

    const firstDrawingWhite = await getWhitePixelCount(page, 1);
    expect(firstDrawingWhite).toBeGreaterThan(initialUnfoldedWhite + 100);

    await clearButton.click();
    await page.waitForTimeout(500);

    const afterClearWhite = await getWhitePixelCount(page, 1);
    expect(afterClearWhite).toBeLessThan(firstDrawingWhite);

    await drawOnCanvas(foldedCanvas, {
      startOffset: { x: 40, y: -40 },
      endOffset: { x: 90, y: 40 }
    });
    await page.waitForTimeout(500);

    const secondDrawingWhite = await getWhitePixelCount(page, 1);
    expect(secondDrawingWhite).toBeGreaterThan(afterClearWhite + 100);

    await undoButton.click();
    await page.waitForTimeout(500);

    const afterUndoWhite = await getWhitePixelCount(page, 1);
    expect(afterUndoWhite).toBeLessThanOrEqual(afterClearWhite + 20);

    await undoButton.click();
    await page.waitForTimeout(500);

    const afterUndoClearWhite = await getWhitePixelCount(page, 1);
    expect(afterUndoClearWhite).toBeGreaterThan(afterClearWhite + 100);
  });

  test('undo preserves unfolded canvas orientation after replay', async ({ page }) => {
    await page.goto('/');

    const foldedCanvas = page.locator('canvas').first();
    const undoButton = page.getByRole('button', { name: 'Undo' });

    await expect(foldedCanvas).toBeVisible();
    await selectDrawingTool(page, 'paintbrush');

    await drawOnCanvas(foldedCanvas, {
      startOffset: { x: 80, y: 20 },
      endOffset: { x: 160, y: 110 }
    });
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const canvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Missing unfolded canvas context');

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const mask = new Uint8Array(imageData.data.length / 4);
      let whitePixels = 0;

      for (let i = 0; i < imageData.data.length; i += 4) {
        const pixelIndex = i / 4;
        const isWhite = imageData.data[i] > 240 &&
          imageData.data[i + 1] > 240 &&
          imageData.data[i + 2] > 240;
        if (isWhite) {
          mask[pixelIndex] = 1;
          whitePixels++;
        }
      }

      const win = window as Window & {
        __firstUnfoldedWhiteMask?: Uint8Array;
        __firstUnfoldedWhiteCount?: number;
      };
      win.__firstUnfoldedWhiteMask = mask;
      win.__firstUnfoldedWhiteCount = whitePixels;
    });

    await drawOnCanvas(foldedCanvas, {
      startOffset: { x: 30, y: 140 },
      endOffset: { x: 140, y: 170 }
    });
    await page.waitForTimeout(500);

    await undoButton.click();
    await page.waitForTimeout(500);

    const comparison = await page.evaluate(() => {
      const canvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Missing unfolded canvas context');

      const win = window as Window & {
        __firstUnfoldedWhiteMask?: Uint8Array;
        __firstUnfoldedWhiteCount?: number;
      };
      const firstMask = win.__firstUnfoldedWhiteMask;
      if (!firstMask) throw new Error('Missing first unfolded canvas mask');

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let currentWhite = 0;
      let changedWhiteMaskPixels = 0;

      for (let i = 0; i < imageData.data.length; i += 4) {
        const pixelIndex = i / 4;
        const isWhite = imageData.data[i] > 240 &&
          imageData.data[i + 1] > 240 &&
          imageData.data[i + 2] > 240;
        if (isWhite) currentWhite++;
        if ((isWhite ? 1 : 0) !== firstMask[pixelIndex]) {
          changedWhiteMaskPixels++;
        }
      }

      return {
        firstWhite: win.__firstUnfoldedWhiteCount ?? 0,
        currentWhite,
        changedWhiteMaskPixels
      };
    });

    expect(comparison.firstWhite).toBeGreaterThan(100);
    expect(comparison.currentWhite).toBeGreaterThan(100);
    expect(comparison.changedWhiteMaskPixels).toBeLessThan(comparison.firstWhite * 0.03 + 200);
  });

  test('shape tools draw on folded canvas and mirror to unfolded canvas', async ({ page }) => {
    for (const tool of ['rectangle', 'square', 'circle'] as const) {
      await page.goto('/');

      const foldedCanvas = page.locator('canvas').first();
      await expect(foldedCanvas).toBeVisible();

      await selectDrawingTool(page, tool);

      const foldedBefore = await analyzeCanvasPixels(page, 0);
      const unfoldedBefore = await analyzeCanvasPixels(page, 1);

      await drawOnCanvas(foldedCanvas, {
        startOffset: { x: 20, y: 20 },
        endOffset: { x: 90, y: 80 }
      });

      await page.waitForTimeout(500);

      const foldedAfter = await analyzeCanvasPixels(page, 0);
      const unfoldedAfter = await analyzeCanvasPixels(page, 1);
      const foldedDelta = foldedAfter.pixelCounts.white - foldedBefore.pixelCounts.white;
      const unfoldedDelta = unfoldedAfter.pixelCounts.white - unfoldedBefore.pixelCounts.white;

      console.log(`${tool} shape mirroring:
        Folded delta: +${foldedDelta}
        Unfolded delta: +${unfoldedDelta}`);

      expect(foldedDelta).toBeGreaterThan(0);
      expect(unfoldedDelta).toBeGreaterThan(0);
      expect(unfoldedAfter.pixelCounts.white).toBeGreaterThan(foldedAfter.pixelCounts.white);
    }
  });

  test('shape tools default to filled and can switch to outline mode', async ({ page }) => {
    await page.goto('/');

    const foldedCanvas = page.locator('canvas').first();
    await expect(foldedCanvas).toBeVisible();

    await selectDrawingTool(page, 'rectangle');
    await expect(page.locator('input[name="shapeFillMode"][value="filled"]')).toBeChecked();

    const filledComparison = await compareCanvasBeforeAfterDrawing(
      page,
      async () => {
        await drawOnCanvas(foldedCanvas, {
          startOffset: { x: 20, y: 20 },
          endOffset: { x: 120, y: 100 }
        });
      },
      0
    );

    await page.getByRole('button', { name: 'Clear' }).click();
    await page.waitForTimeout(500);
    await selectDrawingTool(page, 'rectangle');
    await selectShapeFillMode(page, 'outline');

    const outlineComparison = await compareCanvasBeforeAfterDrawing(
      page,
      async () => {
        await drawOnCanvas(foldedCanvas, {
          startOffset: { x: 20, y: 20 },
          endOffset: { x: 120, y: 100 }
        });
      },
      0
    );

    expect(filledComparison.drawingOccurred).toBe(true);
    expect(outlineComparison.drawingOccurred).toBe(true);
    expect(filledComparison.whitePixelsDelta).toBeGreaterThan(outlineComparison.whitePixelsDelta * 2);
  });

  test('diagonal fold clips tool rendering to drawable region', async ({ page }) => {
    const countFoldedWhiteRegions = async () => page.evaluate(() => {
      const canvas = document.querySelectorAll('canvas')[0] as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { drawable: 0, invalid: 0 };

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let drawable = 0;
      let invalid = 0;
      const diagonalMargin = 12;

      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const index = (y * canvas.width + x) * 4;
          const r = imageData.data[index];
          const g = imageData.data[index + 1];
          const b = imageData.data[index + 2];
          const isWhite = r > 240 && g > 240 && b > 240;

          if (!isWhite) continue;

          if (x + y > canvas.width + diagonalMargin) {
            drawable += 1;
          } else if (x + y < canvas.width - diagonalMargin) {
            invalid += 1;
          }
        }
      }

      return { drawable, invalid };
    });

    for (const tool of ['paintbrush', 'line', 'rectangle', 'square', 'circle'] as const) {
      await page.goto('/');

      const foldedCanvas = page.locator('canvas').first();
      await expect(foldedCanvas).toBeVisible();

      await selectDrawingTool(page, tool);

      const before = await countFoldedWhiteRegions();

      await drawOnCanvas(foldedCanvas, {
        startOffset: { x: -120, y: -110 },
        endOffset: { x: 90, y: 80 }
      });

      await page.waitForTimeout(500);

      const after = await countFoldedWhiteRegions();

      expect(after.drawable - before.drawable).toBeGreaterThan(0);
      expect(after.invalid - before.invalid).toBe(0);
    }
  });
});
