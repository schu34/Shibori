import { expect, test } from '@playwright/test';
import { drawDeterministicStroke, DualModeTestRunner } from '../utils/DualModeTestRunner';

test.describe('Canvas 2D and WebGL user-visible parity', () => {
  test('runs the same mirrored drawing through both backends', async ({ page }, testInfo) => {
    const runner = new DualModeTestRunner(page, testInfo);
    const result = await runner.compareDrawingOutput(
      () => drawDeterministicStroke(page),
      1
    );

    console.log('Backend parity result:', result);

    expect(result.canvas2d.whitePixels).toBeGreaterThan(200);
    expect(result.webgl.whitePixels).toBeGreaterThan(200);
    expect(result.similarity).toBeGreaterThan(0.98);
  });
});
