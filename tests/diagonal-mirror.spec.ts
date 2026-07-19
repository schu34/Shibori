import { expect, test } from '@playwright/test';

type DiagonalDirection = 'topRightToBottomLeft' | 'topLeftToBottomRight';

test.describe('diagonal mirror boundary', () => {
  for (const direction of [
    'topRightToBottomLeft',
    'topLeftToBottomRight',
  ] as const satisfies readonly DiagonalDirection[]) {
    test(`joins both sides without a one-pixel seam for ${direction}`, async ({ page }) => {
      await page.goto('/');

      const boundary = await page.evaluate(async (diagonalDirection) => {
        const moduleUrl = '/src/rendering/CanvasMirror.ts';
        const canvasServiceModuleUrl = '/src/services/CanvasService.ts';
        const { renderUnfoldedCanvas } = await import(/* @vite-ignore */ moduleUrl) as typeof import('../src/rendering/CanvasMirror');
        const { CanvasService } = await import(/* @vite-ignore */ canvasServiceModuleUrl) as typeof import('../src/services/CanvasService');
        const size = 64;
        const foldCount = 1;
        const foldedCanvas = document.createElement('canvas');
        const unfoldedCanvas = document.createElement('canvas');
        foldedCanvas.width = foldedCanvas.height = size;
        unfoldedCanvas.width = unfoldedCanvas.height = size;

        const foldedCtx = foldedCanvas.getContext('2d');
        const unfoldedCtx = unfoldedCanvas.getContext('2d');
        if (!foldedCtx || !unfoldedCtx) throw new Error('Canvas 2D is unavailable');

        foldedCtx.fillStyle = 'navy';
        foldedCtx.fillRect(0, 0, size, size);
        foldedCtx.fillStyle = 'white';
        foldedCtx.save();
        CanvasService.clipToDrawableRegion(foldedCtx, foldedCanvas, {
          vertical: foldCount,
          horizontal: foldCount,
          diagonal: {
            enabled: true,
            count: 1,
            direction: diagonalDirection,
          },
        });
        foldedCtx.fillRect(0, 0, size, size);
        foldedCtx.restore();

        renderUnfoldedCanvas({
          foldedCanvas,
          unfoldedCanvas,
          foldedCtx,
          unfoldedCtx,
        }, {
          vertical: foldCount,
          horizontal: foldCount,
          diagonal: {
            enabled: true,
            count: 1,
            direction: diagonalDirection,
          },
        });

        const pixels = unfoldedCtx.getImageData(0, 0, size, size).data;
        let darkestInteriorChannel = 255;
        let interiorPixelsBelowWhite = 0;
        for (let y = 2; y < size - 2; y += 1) {
          for (let x = 2; x < size - 2; x += 1) {
            const index = (y * size + x) * 4;
            const lightestChannel = Math.min(pixels[index], pixels[index + 1], pixels[index + 2]);
            darkestInteriorChannel = Math.min(darkestInteriorChannel, lightestChannel);
            if (lightestChannel < 250) interiorPixelsBelowWhite += 1;
          }
        }

        return { darkestInteriorChannel, interiorPixelsBelowWhite };
      }, direction);

      expect(boundary.darkestInteriorChannel).toBeGreaterThanOrEqual(250);
      expect(boundary.interiorPixelsBelowWhite).toBe(0);
    });
  }
});
