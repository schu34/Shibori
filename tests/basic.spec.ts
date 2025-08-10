import { test, expect } from '@playwright/test';
import { 
  analyzeCanvasPixels, 
  compareCanvasBeforeAfterDrawing, 
  drawOnCanvas, 
  selectDrawingTool 
} from './utils/canvasHelpers';

test.describe('Shibori Canvas App', () => {
  test('loads app and shows canvas elements', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for the app to load
    await expect(page.locator('h1')).toContainText('Folded Paper Drawing');

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
});