import { expect, test } from '@playwright/test';

const benchmarkEnabled = process.env.SHIBORI_RENDERER_BENCHMARK === 'true';

test.describe('renderer benchmark evidence', () => {
  test.skip(!benchmarkEnabled, 'Set SHIBORI_RENDERER_BENCHMARK=true to run expensive renderer benchmarks');
  test.setTimeout(180_000);

  test('measures ImageData, transform Canvas 2D, and WebGL mirroring', async ({ page }, testInfo) => {
    await page.goto('/');

    const evidence = await page.evaluate(async () => {
      const moduleUrl = '/src/rendering/rendererBenchmarkHarness.ts';
      const benchmarkModule = await import(/* @vite-ignore */ moduleUrl) as {
        runRendererEvidence: () => Promise<unknown>;
      };
      return benchmarkModule.runRendererEvidence();
    });

    await testInfo.attach('renderer-evidence.json', {
      body: JSON.stringify(evidence, null, 2),
      contentType: 'application/json',
    });

    console.log('RENDERER_EVIDENCE_START');
    console.log(JSON.stringify(evidence, null, 2));
    console.log('RENDERER_EVIDENCE_END');

    const typedEvidence = evidence as {
      diagonalProbe: Array<{
        renderer: string;
        supported: boolean;
        sourceRegionWhitePixels: number;
        expectedMirrorRegionWhitePixels: number;
      }>;
    };
    const imageDataProbe = typedEvidence.diagonalProbe.find(
      (result) => result.renderer === 'canvas2d-imagedata'
    );
    const transformProbe = typedEvidence.diagonalProbe.find(
      (result) => result.renderer === 'canvas2d-transform'
    );

    expect(imageDataProbe?.sourceRegionWhitePixels).toBeGreaterThan(0);
    expect(imageDataProbe?.expectedMirrorRegionWhitePixels).toBeGreaterThan(0);
    expect(transformProbe?.sourceRegionWhitePixels).toBeGreaterThan(0);
    expect(transformProbe?.expectedMirrorRegionWhitePixels).toBeGreaterThan(0);
  });
});
