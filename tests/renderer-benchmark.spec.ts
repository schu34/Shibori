import { expect, test } from '@playwright/test';

const benchmarkEnabled = process.env.SHIBORI_RENDERER_BENCHMARK === 'true';

test.describe('renderer benchmark evidence', () => {
  test.skip(!benchmarkEnabled, 'Set SHIBORI_RENDERER_BENCHMARK=true to run expensive renderer benchmarks');
  test.setTimeout(180_000);

  test('keeps production transform mirroring within its measured budgets', async ({ page }, testInfo) => {
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
      benchmarks: Array<{
        scenario: { name: string; budgetMs: number | null };
        meanMs: number;
      }>;
      diagonalProbe: {
        sourceRegionWhitePixels: number;
        expectedMirrorRegionWhitePixels: number;
        verticallyFlippedSourceRegionWhitePixels: number;
        verticallyFlippedMirrorRegionWhitePixels: number;
      };
    };
    for (const result of typedEvidence.benchmarks) {
      if (result.scenario.budgetMs !== null) {
        expect(result.meanMs, result.scenario.name).toBeLessThanOrEqual(result.scenario.budgetMs);
      }
    }
    expect(typedEvidence.diagonalProbe.sourceRegionWhitePixels).toBeGreaterThan(0);
    expect(typedEvidence.diagonalProbe.expectedMirrorRegionWhitePixels).toBeGreaterThan(0);
    expect(typedEvidence.diagonalProbe.verticallyFlippedSourceRegionWhitePixels).toBe(0);
    expect(typedEvidence.diagonalProbe.verticallyFlippedMirrorRegionWhitePixels).toBe(0);
  });
});
