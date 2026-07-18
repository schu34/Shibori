import { test, expect, type Locator, type Page } from '@playwright/test';
import { 
  analyzeCanvasPixels, 
  compareCanvasBeforeAfterDrawing, 
  drawBezierOnCanvas,
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
    const canvases = page.locator('.canvas-container canvas');
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

  test('select move tool drags a drawn stroke and updates unfolded canvas', async ({ page }) => {
    await page.goto('/');

    const foldedCanvas = page.locator('canvas').first();
    await expect(foldedCanvas).toBeVisible();

    await selectDrawingTool(page, 'paintbrush');
    await drawOnCanvas(foldedCanvas, {
      startOffset: { x: 40, y: 200 },
      endOffset: { x: 120, y: 200 }
    });
    await page.waitForTimeout(500);

    const beforeLeft = await getWhiteRegionCount(page, 0, {
      minXOffset: -150,
      maxXOffset: 150,
      minYOffset: 170,
      maxYOffset: 230
    });
    const beforeRight = await getWhiteRegionCount(page, 0, {
      minXOffset: 160,
      maxXOffset: 300,
      minYOffset: 170,
      maxYOffset: 230
    });
    await storeWhiteMask(page, 1, '__unfoldedBeforeMoveMask');

    expect(beforeLeft).toBeGreaterThan(100);

    await selectDrawingTool(page, 'selectMove');
    await dragCanvasAtOffsets(foldedCanvas, { x: 80, y: 200 }, { x: 220, y: 200 });
    await page.waitForTimeout(500);

    const afterLeft = await getWhiteRegionCount(page, 0, {
      minXOffset: -150,
      maxXOffset: 150,
      minYOffset: 170,
      maxYOffset: 230
    });
    const afterRight = await getWhiteRegionCount(page, 0, {
      minXOffset: 160,
      maxXOffset: 300,
      minYOffset: 170,
      maxYOffset: 230
    });
    const unfoldedChangedPixels = await compareWhiteMask(page, 1, '__unfoldedBeforeMoveMask');

    expect(afterLeft).toBeLessThan(beforeLeft * 0.7);
    expect(afterRight).toBeGreaterThan(beforeRight + 100);
    expect(unfoldedChangedPixels).toBeGreaterThan(200);
  });

  test('select move tool updates unfolded preview during drag', async ({ page }) => {
    await page.goto('/');

    const foldedCanvas = page.locator('canvas').first();
    await expect(foldedCanvas).toBeVisible();

    await selectDrawingTool(page, 'paintbrush');
    await drawOnCanvas(foldedCanvas, {
      startOffset: { x: 40, y: 200 },
      endOffset: { x: 120, y: 200 }
    });
    await page.waitForTimeout(500);

    await selectDrawingTool(page, 'selectMove');
    await storeWhiteMask(page, 1, '__unfoldedBeforeLiveDragMask');

    await moveCanvasMouse(page, foldedCanvas, { x: 80, y: 200 });
    await page.mouse.down();
    await page.waitForTimeout(100);
    await moveCanvasMouse(page, foldedCanvas, { x: 220, y: 200 });

    await expect.poll(
      () => compareWhiteMask(page, 1, '__unfoldedBeforeLiveDragMask'),
      { timeout: 3000 }
    ).toBeGreaterThan(200);

    await storeWhiteMask(page, 1, '__unfoldedAfterFirstLiveDragFrameMask');
    await moveCanvasMouse(page, foldedCanvas, { x: 260, y: 200 });

    await expect.poll(
      () => compareWhiteMask(page, 1, '__unfoldedAfterFirstLiveDragFrameMask'),
      { timeout: 3000 }
    ).toBeGreaterThan(50);

    await page.mouse.up();
  });

  test('select move tool nudges selected stroke with arrow keys', async ({ page }) => {
    await page.goto('/');

    const foldedCanvas = page.locator('canvas').first();
    await expect(foldedCanvas).toBeVisible();

    await selectDrawingTool(page, 'paintbrush');
    await drawOnCanvas(foldedCanvas, {
      startOffset: { x: 40, y: 220 },
      endOffset: { x: 120, y: 220 }
    });
    await page.waitForTimeout(500);

    await selectDrawingTool(page, 'selectMove');
    await clickCanvasAtOffset(foldedCanvas, { x: 80, y: 220 });
    await page.waitForTimeout(100);
    await storeWhiteMask(page, 0, '__foldedBeforeNudgeMask');

    await page.keyboard.press('Shift+ArrowRight');
    await page.waitForTimeout(500);

    const foldedChangedPixels = await compareWhiteMask(page, 0, '__foldedBeforeNudgeMask');
    expect(foldedChangedPixels).toBeGreaterThan(50);
  });

  test('select move tool deletes selected stroke with Delete key and undo restores it', async ({ page }) => {
    await page.goto('/');

    const foldedCanvas = page.locator('canvas').first();
    const undoButton = page.getByRole('button', { name: 'Undo' });
    await expect(foldedCanvas).toBeVisible();

    await selectDrawingTool(page, 'paintbrush');
    await drawOnCanvas(foldedCanvas, {
      startOffset: { x: 40, y: 220 },
      endOffset: { x: 120, y: 220 }
    });
    await page.waitForTimeout(500);

    await selectDrawingTool(page, 'selectMove');
    await clickCanvasAtOffset(foldedCanvas, { x: 80, y: 220 });
    await page.waitForTimeout(100);
    await expect(page.locator('.selection-overlay')).toBeVisible();
    await storeWhiteMask(page, 0, '__foldedBeforeDeleteKeyMask');
    const beforeDeleteWhite = await getWhitePixelCount(page, 0);

    await page.keyboard.press('Delete');
    await page.waitForTimeout(500);

    const afterDeleteWhite = await getWhitePixelCount(page, 0);
    const deleteChangedPixels = await compareWhiteMask(page, 0, '__foldedBeforeDeleteKeyMask');
    expect(afterDeleteWhite).toBeLessThan(beforeDeleteWhite - 100);
    expect(deleteChangedPixels).toBeGreaterThan(100);
    await expect(page.locator('.selection-overlay')).toHaveCount(0);

    await undoButton.click();
    await page.waitForTimeout(500);

    const afterUndoWhite = await getWhitePixelCount(page, 0);
    expect(afterUndoWhite).toBeGreaterThan(afterDeleteWhite + 100);
  });

  test('select move tool deletes selected rectangle with overlay delete button', async ({ page }) => {
    await page.goto('/');

    const foldedCanvas = page.locator('canvas').first();
    await expect(foldedCanvas).toBeVisible();

    await selectDrawingTool(page, 'rectangle');
    await drawOnCanvas(foldedCanvas, {
      startOffset: { x: 20, y: 20 },
      endOffset: { x: 120, y: 80 }
    });
    await page.waitForTimeout(500);

    await selectDrawingTool(page, 'selectMove');
    await clickCanvasAtOffset(foldedCanvas, { x: 70, y: 50 });
    await page.waitForTimeout(100);
    await expect(page.getByRole('button', { name: 'Delete selected drawing' })).toBeVisible();

    const beforeDeleteWhite = await getWhitePixelCount(page, 0);
    await page.getByRole('button', { name: 'Delete selected drawing' }).click();
    await page.waitForTimeout(500);

    const afterDeleteWhite = await getWhitePixelCount(page, 0);
    expect(afterDeleteWhite).toBeLessThan(beforeDeleteWhite - 100);
    await expect(page.locator('.selection-overlay')).toHaveCount(0);
  });

  test('select move tool rotates a selected rectangle by dragging a corner', async ({ page }) => {
    await page.goto('/');

    const foldedCanvas = page.locator('canvas').first();
    await expect(foldedCanvas).toBeVisible();

    await selectDrawingTool(page, 'rectangle');
    await drawOnCanvas(foldedCanvas, {
      startOffset: { x: 20, y: 20 },
      endOffset: { x: 120, y: 80 }
    });
    await page.waitForTimeout(500);

    await selectDrawingTool(page, 'selectMove');
    await clickCanvasAtOffset(foldedCanvas, { x: 70, y: 50 });
    await page.waitForTimeout(100);
    await expect(page.locator('.selection-rotate-handle')).toHaveCount(4);

    await storeWhiteMask(page, 0, '__foldedBeforeRotateMask');
    await storeWhiteMask(page, 1, '__unfoldedBeforeRotateMask');

    await dragCanvasAtOffsets(foldedCanvas, { x: 130, y: 10 }, { x: 180, y: 110 });
    await page.waitForTimeout(500);

    const foldedChangedPixels = await compareWhiteMask(page, 0, '__foldedBeforeRotateMask');
    const unfoldedChangedPixels = await compareWhiteMask(page, 1, '__unfoldedBeforeRotateMask');
    const overlayTransform = await page.locator('.selection-overlay').evaluate((element) =>
      window.getComputedStyle(element).transform
    );

    expect(foldedChangedPixels).toBeGreaterThan(100);
    expect(unfoldedChangedPixels).toBeGreaterThan(200);
    expect(overlayTransform).not.toBe('none');
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

  test('bezier uses two gestures, keeps guides out of artwork, and mirrors the committed curve', async ({ page }) => {
    await page.goto('/');
    const foldedCanvas = page.getByLabel('Folded drawing canvas');
    await selectDrawingTool(page, 'bezier');
    await foldedCanvas.scrollIntoViewIfNeeded();

    const foldedBefore = await analyzeCanvasPixels(page, 0);
    const unfoldedBefore = await analyzeCanvasPixels(page, 1);
    const box = await foldedCanvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    const center = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };

    await page.mouse.move(center.x - 90, center.y + 20);
    await page.mouse.down();
    await page.mouse.move(center.x - 60, center.y - 70, { steps: 8 });
    await page.mouse.up();

    await expect(page.getByTestId('bezier-guide-overlay')).toBeVisible();
    expect((await analyzeCanvasPixels(page, 0)).pixelCounts.white).toBe(foldedBefore.pixelCounts.white);
    expect((await analyzeCanvasPixels(page, 1)).pixelCounts.white).toBe(unfoldedBefore.pixelCounts.white);
    await expect(page.getByRole('button', { name: 'Generate Share Link' })).toHaveCount(0);

    await page.mouse.move(center.x + 90, center.y + 20);
    await page.mouse.down();
    await page.mouse.move(center.x + 60, center.y + 90, { steps: 8 });

    await expect.poll(async () => (await analyzeCanvasPixels(page, 1)).pixelCounts.other)
      .toBeGreaterThan(unfoldedBefore.pixelCounts.other + 100);
    await expect(page.getByTestId('bezier-guide-overlay')).toBeVisible();
    await page.mouse.up();

    await expect(page.getByTestId('bezier-guide-overlay')).toHaveCount(0);
    await expect.poll(async () => (await analyzeCanvasPixels(page, 0)).pixelCounts.white)
      .toBeGreaterThan(foldedBefore.pixelCounts.white + 20);
    await expect.poll(async () => (await analyzeCanvasPixels(page, 1)).pixelCounts.white)
      .toBeGreaterThan(unfoldedBefore.pixelCounts.white + 100);
    await expect(page.getByRole('button', { name: 'Generate Share Link' })).toBeVisible();
  });

  test('bezier pending construction cancels on Escape and tool change', async ({ page }) => {
    await page.goto('/');
    const foldedCanvas = page.getByLabel('Folded drawing canvas');
    await selectDrawingTool(page, 'bezier');
    await foldedCanvas.scrollIntoViewIfNeeded();
    const firstGesture = async () => {
      await foldedCanvas.scrollIntoViewIfNeeded();
      const box = await foldedCanvas.boundingBox();
      if (!box) throw new Error('Canvas not found');
      await page.mouse.move(box.x + 40, box.y + 80);
      await page.mouse.down();
      await page.mouse.move(box.x + 80, box.y + 40, { steps: 4 });
      await page.mouse.up();
      await expect(page.getByTestId('bezier-guide-overlay')).toBeVisible();
    };

    await firstGesture();
    await foldedCanvas.press('Escape');
    await expect(page.getByTestId('bezier-guide-overlay')).toHaveCount(0);

    await firstGesture();
    await selectDrawingTool(page, 'line');
    await expect(page.getByTestId('bezier-guide-overlay')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Generate Share Link' })).toHaveCount(0);

    await selectDrawingTool(page, 'bezier');
    await firstGesture();
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByTestId('bezier-guide-overlay')).toHaveCount(0);

    await firstGesture();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('bezier-guide-overlay')).toHaveCount(0);
  });

  test('committed bezier supports move, rotate, delete, and undo', async ({ page }) => {
    await page.goto('/');
    const foldedCanvas = page.getByLabel('Folded drawing canvas');
    await selectDrawingTool(page, 'bezier');
    await drawBezierOnCanvas(page, foldedCanvas);
    await selectDrawingTool(page, 'selectMove');

    await clickCanvasAtOffset(foldedCanvas, { x: 75, y: -20 });
    await expect(page.locator('.selection-overlay')).toBeVisible();
    await storeWhiteMask(page, 0, '__bezierBeforeNudgeMask');
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(() => compareWhiteMask(page, 0, '__bezierBeforeNudgeMask'))
      .toBeGreaterThan(20);
    await storeWhiteMask(page, 1, '__bezierBeforeMoveMask');
    await dragCanvasAtOffsets(foldedCanvas, { x: 85, y: -20 }, { x: 115, y: 10 });
    await expect.poll(() => compareWhiteMask(page, 1, '__bezierBeforeMoveMask'))
      .toBeGreaterThan(100);

    await storeWhiteMask(page, 1, '__bezierBeforeRotateMask');
    const overlayBox = await page.locator('.selection-overlay').boundingBox();
    if (!overlayBox) throw new Error('Selection overlay not found');
    const center = {
      x: overlayBox.x + (overlayBox.width / 2),
      y: overlayBox.y + (overlayBox.height / 2),
    };
    const start = { x: overlayBox.x, y: overlayBox.y };
    const dx = start.x - center.x;
    const dy = start.y - center.y;
    const angle = Math.PI / 3;
    const target = {
      x: center.x + (dx * Math.cos(angle)) - (dy * Math.sin(angle)),
      y: center.y + (dx * Math.sin(angle)) + (dy * Math.cos(angle)),
    };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => compareWhiteMask(page, 1, '__bezierBeforeRotateMask'))
      .toBeGreaterThan(100);

    const beforeDelete = await getWhitePixelCount(page, 0);
    await page.keyboard.press('Delete');
    await expect.poll(() => getWhitePixelCount(page, 0)).toBeLessThan(beforeDelete - 20);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => getWhitePixelCount(page, 0)).toBeGreaterThan(beforeDelete - 20);
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

    await page.goto('/');
    const bezierCanvas = page.locator('canvas').first();
    await selectDrawingTool(page, 'bezier');
    const beforeBezier = await countFoldedWhiteRegions();
    await drawBezierOnCanvas(page, bezierCanvas, {
      startAnchor: { x: -120, y: -110 },
      firstHandle: { x: -80, y: -160 },
      endAnchor: { x: 90, y: 80 },
      endHandle: { x: 130, y: 120 },
    });
    const afterBezier = await countFoldedWhiteRegions();
    expect(afterBezier.drawable - beforeBezier.drawable).toBeGreaterThan(0);
    expect(afterBezier.invalid - beforeBezier.invalid).toBe(0);
  });
});

async function dragCanvasAtOffsets(
  canvas: Locator,
  sourceOffset: { x: number; y: number },
  targetOffset: { x: number; y: number }
): Promise<void> {
  await canvas.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'center' }));
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('Canvas not found');

  await canvas.dragTo(canvas, {
    sourcePosition: {
      x: canvasBox.width / 2 + sourceOffset.x,
      y: canvasBox.height / 2 + sourceOffset.y,
    },
    targetPosition: {
      x: canvasBox.width / 2 + targetOffset.x,
      y: canvasBox.height / 2 + targetOffset.y,
    },
  });
}

async function clickCanvasAtOffset(
  canvas: Locator,
  offset: { x: number; y: number }
): Promise<void> {
  await canvas.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'center' }));
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('Canvas not found');

  await canvas.click({
    position: {
      x: canvasBox.width / 2 + offset.x,
      y: canvasBox.height / 2 + offset.y,
    },
  });
}

async function moveCanvasMouse(
  page: Page,
  canvas: Locator,
  offset: { x: number; y: number }
): Promise<void> {
  await canvas.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'center' }));
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('Canvas not found');

  await page.mouse.move(
    canvasBox.x + canvasBox.width / 2 + offset.x,
    canvasBox.y + canvasBox.height / 2 + offset.y
  );
}

async function getWhiteRegionCount(
  page: Page,
  canvasIndex: number,
  region: {
    minXOffset: number;
    maxXOffset: number;
    minYOffset: number;
    maxYOffset: number;
  }
): Promise<number> {
  return page.evaluate(({ index, testRegion }) => {
    const canvas = document.querySelectorAll('canvas')[index] as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const minX = Math.max(0, Math.floor(centerX + testRegion.minXOffset * scaleX));
    const maxX = Math.min(canvas.width, Math.ceil(centerX + testRegion.maxXOffset * scaleX));
    const minY = Math.max(0, Math.floor(centerY + testRegion.minYOffset * scaleY));
    const maxY = Math.min(canvas.height, Math.ceil(centerY + testRegion.maxYOffset * scaleY));
    const imageData = ctx.getImageData(minX, minY, maxX - minX, maxY - minY);
    let white = 0;

    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 240 && imageData.data[i + 1] > 240 && imageData.data[i + 2] > 240) {
        white++;
      }
    }

    return white;
  }, { index: canvasIndex, testRegion: region });
}

async function storeWhiteMask(
  page: Page,
  canvasIndex: number,
  key: string
): Promise<void> {
  await page.evaluate(({ index, maskKey }) => {
    const canvas = document.querySelectorAll('canvas')[index] as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Missing canvas context');

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const mask = new Uint8Array(imageData.data.length / 4);

    for (let i = 0; i < imageData.data.length; i += 4) {
      const isWhite = imageData.data[i] > 240 &&
        imageData.data[i + 1] > 240 &&
        imageData.data[i + 2] > 240;
      mask[i / 4] = isWhite ? 1 : 0;
    }

    (window as unknown as Record<string, Uint8Array>)[maskKey] = mask;
  }, { index: canvasIndex, maskKey: key });
}

async function compareWhiteMask(
  page: Page,
  canvasIndex: number,
  key: string
): Promise<number> {
  return page.evaluate(({ index, maskKey }) => {
    const canvas = document.querySelectorAll('canvas')[index] as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Missing canvas context');

    const previous = (window as unknown as Record<string, Uint8Array>)[maskKey];
    if (!previous) throw new Error(`Missing stored mask ${maskKey}`);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let changed = 0;

    for (let i = 0; i < imageData.data.length; i += 4) {
      const isWhite = imageData.data[i] > 240 &&
        imageData.data[i + 1] > 240 &&
        imageData.data[i + 2] > 240;
      if ((isWhite ? 1 : 0) !== previous[i / 4]) {
        changed++;
      }
    }

    return changed;
  }, { index: canvasIndex, maskKey: key });
}
