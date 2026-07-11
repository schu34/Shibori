import { expect, test } from '@playwright/test';
import {
  analyzeCanvasPixels,
  drawOnCanvas,
} from './utils/canvasHelpers';

test('draws on the folded canvas and mirrors into every unfolded quadrant', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Shibori Folding' })).toBeVisible();

  const foldedCanvas = page.locator('canvas').first();
  const foldedBefore = await analyzeCanvasPixels(page, 0);
  const unfoldedBefore = await analyzeCanvasPixels(page, 1);
  const quadrantsBefore = await getQuadrantWhiteCounts(page);

  await drawOnCanvas(foldedCanvas);

  await expect.poll(async () => (await analyzeCanvasPixels(page, 0)).pixelCounts.white)
    .toBeGreaterThan(foldedBefore.pixelCounts.white + 100);
  await expect.poll(async () => (await analyzeCanvasPixels(page, 1)).pixelCounts.white)
    .toBeGreaterThan(unfoldedBefore.pixelCounts.white + 200);

  const quadrantsAfter = await getQuadrantWhiteCounts(page);
  quadrantsAfter.forEach((whitePixels, index) => {
    expect(whitePixels, `unfolded quadrant ${index + 1}`).toBeGreaterThan(quadrantsBefore[index] + 30);
  });
});

test('sizes the folded canvas to unmatched folds while keeping square fold grids full resolution', async ({ page }) => {
  await page.goto('/');

  const foldedCanvas = page.getByLabel('Folded drawing canvas');
  await expect(foldedCanvas).toHaveAttribute('width', '1600');
  await expect(foldedCanvas).toHaveAttribute('height', '1600');

  await page.getByTitle('Decrease vertical folds').click();
  await page.getByTitle('Increase horizontal folds').click();
  await page.getByTitle('Increase horizontal folds').click();

  await expect(page.getByText('Vertical Folds: 0')).toBeVisible();
  await expect(page.getByText('Horizontal Folds: 3')).toBeVisible();
  await expect(foldedCanvas).toHaveAttribute('width', '1600');
  await expect(foldedCanvas).toHaveAttribute('height', '200');

  const foldedDisplay = await foldedCanvas.evaluate((canvas) => ({
    width: canvas.clientWidth,
    height: canvas.clientHeight,
  }));
  // Browser layout rounds the very short rendered height to whole pixels.
  expect(foldedDisplay.width / foldedDisplay.height).toBeCloseTo(8, 1);

  const foldedBefore = await analyzeCanvasPixels(page, 0);
  const unfoldedBefore = await analyzeCanvasPixels(page, 1);
  await drawOnCanvas(foldedCanvas, {
    startOffset: { x: -100, y: -25 },
    endOffset: { x: 100, y: 25 },
  });

  await expect.poll(async () => (await analyzeCanvasPixels(page, 0)).pixelCounts.white)
    .toBeGreaterThan(foldedBefore.pixelCounts.white + 100);
  await expect.poll(async () => (await analyzeCanvasPixels(page, 1)).pixelCounts.white)
    .toBeGreaterThan(unfoldedBefore.pixelCounts.white + 800);

  await page.getByRole('button', { name: 'Reset Folds' }).click();
  await page.getByTitle('Increase vertical folds').click();
  await page.getByTitle('Increase vertical folds').click();
  await page.getByTitle('Decrease horizontal folds').click();

  await expect(page.getByText('Vertical Folds: 3')).toBeVisible();
  await expect(page.getByText('Horizontal Folds: 0')).toBeVisible();
  await expect(foldedCanvas).toHaveAttribute('width', '200');
  await expect(foldedCanvas).toHaveAttribute('height', '1600');

  const [tallFoldedDisplay, unfoldedDisplay] = await Promise.all([
    foldedCanvas.evaluate((canvas) => ({
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      top: canvas.getBoundingClientRect().top,
    })),
    page.locator('canvas').nth(1).evaluate((canvas) => ({
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      top: canvas.getBoundingClientRect().top,
    })),
  ]);

  expect(tallFoldedDisplay.width / tallFoldedDisplay.height).toBeCloseTo(1 / 8, 1);
  expect(tallFoldedDisplay.height).toBe(unfoldedDisplay.height);
  expect(tallFoldedDisplay.top).toBeCloseTo(unfoldedDisplay.top, 1);
});

async function getQuadrantWhiteCounts(page: Parameters<typeof analyzeCanvasPixels>[0]): Promise<number[]> {
  return page.evaluate(() => {
    const canvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unfolded canvas context is unavailable');

    const counts = [0, 0, 0, 0];
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const dataIndex = (y * canvas.width + x) * 4;
        if (data[dataIndex] > 240 && data[dataIndex + 1] > 240 && data[dataIndex + 2] > 240) {
          const quadrant = (y >= canvas.height / 2 ? 2 : 0) + (x >= canvas.width / 2 ? 1 : 0);
          counts[quadrant]++;
        }
      }
    }
    return counts;
  });
}
