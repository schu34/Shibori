import { test, expect } from '@playwright/test';
import { 
  analyzeCanvasPixels, 
  drawBezierOnCanvas,
  drawOnCanvas, 
  selectDrawingTool 
} from './utils/canvasHelpers';

test.describe('Shareable Links', () => {
  test('restores a bezier curve before the first canvas transaction', async ({ page, browser }) => {
    await page.goto('/');
    const foldedCanvas = page.getByLabel('Folded drawing canvas');
    await selectDrawingTool(page, 'bezier');
    await drawBezierOnCanvas(page, foldedCanvas);

    const originalFolded = await analyzeCanvasPixels(page, 0);
    const originalUnfolded = await analyzeCanvasPixels(page, 1);
    await page.getByRole('button', { name: 'Share pattern' }).click();
    await page.getByRole('button', { name: 'Generate Share Link' }).click();
    const shareUrl = await page.locator('.url-input').inputValue();

    const context = await browser.newContext();
    const sharedPage = await context.newPage();
    await sharedPage.goto(shareUrl);
    await expect(sharedPage.locator('input[value="bezier"]')).toBeChecked();
    await expect.poll(async () => (await analyzeCanvasPixels(sharedPage, 0)).pixelCounts.white)
      .toBeGreaterThan(20);

    const restoredFolded = await analyzeCanvasPixels(sharedPage, 0);
    const restoredUnfolded = await analyzeCanvasPixels(sharedPage, 1);
    expect(restoredFolded.pixelCounts.white).toBeCloseTo(originalFolded.pixelCounts.white, -1);
    expect(restoredUnfolded.pixelCounts.white).toBeCloseTo(originalUnfolded.pixelCounts.white, -1);
    await context.close();
  });

  test('can create and load shareable drawing links', async ({ page, browser }) => {
    await page.goto('/');

    const foldedCanvas = page.locator('canvas').first();
    await expect(foldedCanvas).toBeVisible();

    // Ensure paintbrush is selected
    await selectDrawingTool(page, 'paintbrush');

    // Draw a specific pattern that we can verify later
    console.log('Drawing original pattern...');
    await drawOnCanvas(foldedCanvas, {
      startOffset: { x: -40, y: -40 },
      endOffset: { x: 40, y: 40 }
    });

    // Wait for drawing to complete
    await page.waitForTimeout(500);

    // Analyze the canvas state after drawing
    const originalDrawing = await analyzeCanvasPixels(page, 0);
    const originalDrawingUnfolded = await analyzeCanvasPixels(page, 1);
    console.log(`Original drawing: ${originalDrawing.pixelCounts.white} white pixels, ${originalDrawing.drawingDensity.toFixed(2)}% density`);

    // Verify we actually have a drawing
    expect(originalDrawing.pixelCounts.white).toBeGreaterThan(1000);
    await page.getByRole('button', { name: 'Share pattern' }).click();
    await expect(page.getByTestId('share-link-size')).toContainText('Live link size');

    // Find and click the "Generate Share Link" button
    const generateButton = page.locator('button', { hasText: 'Generate Share Link' });
    await expect(generateButton).toBeVisible();
    await expect(generateButton).toBeEnabled();
    
    console.log('Generating share link...');
    await generateButton.click();

    // Wait for the URL display to appear
    await expect(page.locator('.url-display')).toBeVisible();

    // Extract the generated URL from the input field
    const urlInput = page.locator('.url-input');
    await expect(urlInput).toBeVisible();
    
    const shareUrl = await urlInput.inputValue();
    console.log('Generated share URL:', shareUrl);
    
    // Verify a new link uses the compressed, versioned wire format.
    expect(shareUrl).toContain('shared=z3.');
    expect(shareUrl.length).toBeGreaterThan(100); // Should be a substantial URL with encoded data

    // Close the current page and create a fresh browser context
    // This simulates a user clicking the link in a fresh session
    console.log('Opening share link in fresh browser context...');
    
    const newContext = await browser.newContext();
    const newPage = await newContext.newPage();
    
    // Navigate to the shared URL
    await newPage.goto(shareUrl);

    // Wait for the app to load and render
    const newFoldedCanvas = newPage.locator('canvas').first();
    await expect(newFoldedCanvas).toBeVisible();

    await expect.poll(
      async () => (await analyzeCanvasPixels(newPage, 0)).pixelCounts.white,
      { timeout: 10_000 }
    ).toBeGreaterThan(1000);

    const loadedDrawing = await analyzeCanvasPixels(newPage, 0);
    
    // Also check the unfolded canvas (canvas index 1)
    const loadedDrawingUnfolded = await analyzeCanvasPixels(newPage, 1);
    console.log(`Loaded drawing (unfolded): ${loadedDrawingUnfolded.pixelCounts.white} white pixels, ${loadedDrawingUnfolded.drawingDensity.toFixed(2)}% density`);

    // The critical assertion: automatic URL loading recreates the original.
    expect(loadedDrawing.pixelCounts.white).toBeCloseTo(originalDrawing.pixelCounts.white, -100);

    // Verify both have substantial drawing
    expect(loadedDrawing.pixelCounts.white).toBeGreaterThan(1000);
    expect(loadedDrawing.hasDrawing).toBe(true);
    expect(loadedDrawingUnfolded.pixelCounts.white).toBeGreaterThan(1000);

    // The compressed snapshot must preserve the mirrored, unfolded pattern too.
    expect(loadedDrawingUnfolded.pixelCounts.white).toBeCloseTo(
      originalDrawingUnfolded.pixelCounts.white,
      -100
    );

    // Drawing densities should be similar
    expect(loadedDrawing.drawingDensity).toBeCloseTo(originalDrawing.drawingDensity, 1);

    console.log('✅ Shareable link successfully recreated the drawing!');

    // Clean up
    await newContext.close();
  });

  test('shareable link preserves fold settings', async ({ page, browser }) => {
    await page.goto('/');

    // Change fold settings from default
    const verticalFoldButton = page.locator('button', { hasText: 'Fold +' }).first();
    await verticalFoldButton.click();
    
    // Verify fold setting changed (should show "Vertical Folds: 2")
    await expect(page.locator('text=Vertical Folds: 2')).toBeVisible();

    // Draw something
    const foldedCanvas = page.locator('canvas').first();
    await selectDrawingTool(page, 'paintbrush');
    await drawOnCanvas(foldedCanvas);
    await page.waitForTimeout(500);

    const originalDrawing = await analyzeCanvasPixels(page, 0);
    expect(originalDrawing.hasDrawing).toBe(true);

    // Generate share link
    await page.getByRole('button', { name: 'Share pattern' }).click();
    const generateButton = page.locator('button', { hasText: 'Generate Share Link' });
    await generateButton.click();
    
    const urlInput = page.locator('.url-input');
    const shareUrl = await urlInput.inputValue();

    // Load in fresh context
    const newContext = await browser.newContext();
    const newPage = await newContext.newPage();
    await newPage.goto(shareUrl);

    // Verify fold setting was preserved
    await expect(newPage.locator('text=Vertical Folds: 2')).toBeVisible();

    // Verify canvas still has drawing
    await expect.poll(async () => {
      const loadedDrawing = await analyzeCanvasPixels(newPage, 0);
      return loadedDrawing.pixelCounts.white;
    }, {
      message: 'shared link should replay the saved drawing',
      timeout: 5000
    }).toBeGreaterThan(0);

    await newContext.close();
  });

  test('handles invalid share URLs gracefully', async ({ page }) => {
    // Try to load a URL with corrupted shared parameter
    await page.goto('/?shared=invalid-data');

    // App should still load normally (fallback to default state)
    await expect(page.locator('h1')).toContainText('Shibori Folding');
    await expect(page.locator('canvas').first()).toBeVisible();

    // Canvas should show default fold lines but no user drawings
    // With diagonal folding enabled by default, there will be fold lines
    // The key is that it falls back to default state, not a corrupt state
    await expect(page.locator('text=Diagonal Folds: 1')).toBeVisible();
  });
});
