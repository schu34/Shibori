import { test, expect } from '@playwright/test';
import { analyzeCanvasPixels, drawOnCanvas } from './utils/canvasHelpers';

test.describe('Fold Lines Rendering', () => {
  test('shows fold guides as overlays without painting either canvas', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toContainText('Shibori Folding');
    await expect(page.locator('.fold-guide-overlay')).toHaveCount(2);
    await expect(page.locator('.folded-canvas-frame .fold-guide-diagonal')).toHaveCount(1);
    await expect(page.locator('.unfolded-canvas-frame .fold-guide-diagonal')).toHaveCount(4);
    expect(await page.locator('.unfolded-canvas-frame .fold-guide-diagonal').evaluateAll((lines) => (
      lines.map((line) => [
        line.getAttribute('x1'),
        line.getAttribute('y1'),
        line.getAttribute('x2'),
        line.getAttribute('y2'),
      ])
    ))).toEqual([
      ['800', '0', '0', '800'],
      ['800', '0', '1600', '800'],
      ['0', '800', '800', '1600'],
      ['1600', '800', '800', '1600'],
    ]);

    const foldedAnalysis = await analyzeCanvasPixels(page, 0);
    const unfoldedAnalysis = await analyzeCanvasPixels(page, 1);
    expect(foldedAnalysis.pixelCounts.white).toBe(0);
    expect(unfoldedAnalysis.pixelCounts.white).toBe(0);
  });

  test('shows the unfolded grid guides for vertical and horizontal folds', async ({ page }) => {
    await page.goto('/');

    const verticalFoldButton = page.locator('button', { hasText: 'Fold +' }).first();
    await verticalFoldButton.click();
    const horizontalFoldButton = page.locator('button', { hasText: 'Fold +' }).nth(1);
    await horizontalFoldButton.click();
    await expect(page.locator('.unfolded-canvas-frame .fold-guide-vertical')).toHaveCount(3);
    await expect(page.locator('.unfolded-canvas-frame .fold-guide-horizontal')).toHaveCount(3);
    await expect(page.locator('.unfolded-canvas-frame .fold-guide-diagonal')).toHaveCount(16);
    await expect(page.locator('.folded-canvas-frame .fold-guide-vertical')).toHaveCount(0);
    await expect(page.locator('.folded-canvas-frame .fold-guide-horizontal')).toHaveCount(0);
  });

  test('hides and restores both guide overlays without changing canvas pixels', async ({ page }) => {
    await page.goto('/');
    await drawOnCanvas(page.locator('canvas').first(), {
      startOffset: { x: 60, y: 0 },
      endOffset: { x: 120, y: 0 },
    });

    const unfoldedBeforeToggle = await analyzeCanvasPixels(page, 1);
    expect(unfoldedBeforeToggle.pixelCounts.white).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Hide fold guides' }).click();
    await expect(page.locator('.fold-guide-overlay')).toHaveCount(0);

    const unfoldedWhileHidden = await analyzeCanvasPixels(page, 1);
    expect(unfoldedWhileHidden.pixelCounts.white).toBe(unfoldedBeforeToggle.pixelCounts.white);

    await page.getByRole('button', { name: 'Show fold guides' }).click();
    await expect(page.locator('.fold-guide-overlay')).toHaveCount(2);
  });
});
