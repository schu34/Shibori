import type { CanvasContext, FoldState } from '../services/CanvasService';
import { renderUnfoldedCanvas } from './CanvasMirror';

export interface RendererBenchmarkScenario {
  name: string;
  size: number;
  folds: FoldState;
  iterations: number;
  budgetMs: number | null;
}

export interface RendererBenchmarkResult {
  scenario: RendererBenchmarkScenario;
  samplesMs: number[];
  meanMs: number;
  minMs: number;
  maxMs: number;
}

export interface DiagonalProbeResult {
  sourceRegionWhitePixels: number;
  expectedMirrorRegionWhitePixels: number;
  verticallyFlippedSourceRegionWhitePixels: number;
  verticallyFlippedMirrorRegionWhitePixels: number;
  totalWhitePixels: number;
}

export interface RendererEvidence {
  renderer: 'canvas2d-transform';
  userAgent: string;
  generatedAt: string;
  benchmarks: RendererBenchmarkResult[];
  diagonalProbe: DiagonalProbeResult;
}

export function defaultRendererBenchmarkScenarios(): RendererBenchmarkScenario[] {
  return [800, 1600, 3200].flatMap((size) => {
    const iterations = size === 800 ? 3 : size === 1600 ? 2 : 1;
    return [
      scenario(`${size}-no-folds`, size, iterations, folds(0, 0, false), null),
      scenario(
        `${size}-default-diagonal`,
        size,
        iterations,
        folds(1, 1, true),
        size === 1600 ? 16.7 : size === 3200 ? 50 : null
      ),
      scenario(
        `${size}-max-grid-diagonal`,
        size,
        iterations,
        folds(3, 3, true),
        size === 1600 ? 16.7 : size === 3200 ? 50 : null
      ),
    ];
  });
}

/** Browser-only, opt-in performance guard for the production renderer. */
export function runRendererEvidence(
  scenarios = defaultRendererBenchmarkScenarios()
): RendererEvidence {
  return {
    renderer: 'canvas2d-transform',
    userAgent: navigator.userAgent,
    generatedAt: new Date().toISOString(),
    benchmarks: scenarios.map(benchmarkScenario),
    diagonalProbe: runDiagonalSemanticsProbe(),
  };
}

function benchmarkScenario(scenario: RendererBenchmarkScenario): RendererBenchmarkResult {
  const foldedCanvas = createFoldedFixture(scenario.size);
  const target = createCanvas(scenario.size, scenario.size);
  const context = createContext(foldedCanvas, target);

  renderUnfoldedCanvas(context, scenario.folds);
  const samplesMs: number[] = [];
  for (let iteration = 0; iteration < scenario.iterations; iteration++) {
    const startedAt = performance.now();
    renderUnfoldedCanvas(context, scenario.folds);
    samplesMs.push(performance.now() - startedAt);
  }

  return {
    scenario,
    samplesMs,
    meanMs: samplesMs.reduce((total, sample) => total + sample, 0) / samplesMs.length,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
  };
}

function runDiagonalSemanticsProbe(): DiagonalProbeResult {
  const size = 64;
  const foldedCanvas = createCanvas(size, size);
  const foldedCtx = get2DContext(foldedCanvas);
  foldedCtx.fillStyle = 'navy';
  foldedCtx.fillRect(0, 0, size, size);
  foldedCtx.fillStyle = 'white';
  foldedCtx.fillRect(46, 40, 5, 3);

  const target = createCanvas(size, size);
  renderUnfoldedCanvas(createContext(foldedCanvas, target), folds(0, 0, true));
  const image = get2DContext(target).getImageData(0, 0, size, size);

  return {
    sourceRegionWhitePixels: countWhiteInRegion(image, 44, 38, 53, 45),
    expectedMirrorRegionWhitePixels: countWhiteInRegion(image, 17, 11, 24, 20),
    verticallyFlippedSourceRegionWhitePixels: countWhiteInRegion(image, 44, 19, 53, 26),
    verticallyFlippedMirrorRegionWhitePixels: countWhiteInRegion(image, 17, 44, 24, 53),
    totalWhitePixels: countWhitePixels(image),
  };
}

function scenario(
  name: string,
  size: number,
  iterations: number,
  foldState: FoldState,
  budgetMs: number | null
): RendererBenchmarkScenario {
  return { name, size, iterations, folds: foldState, budgetMs };
}

function createFoldedFixture(size: number): HTMLCanvasElement {
  const canvas = createCanvas(size, size);
  const ctx = get2DContext(canvas);
  ctx.fillStyle = 'navy';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'white';
  ctx.fillStyle = 'white';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(4, size / 160);
  ctx.beginPath();
  ctx.moveTo(size * 0.62, size * 0.52);
  ctx.bezierCurveTo(size * 0.7, size * 0.56, size * 0.73, size * 0.7, size * 0.84, size * 0.74);
  ctx.stroke();
  ctx.fillRect(size * 0.74, size * 0.42, size * 0.035, size * 0.055);
  ctx.beginPath();
  ctx.arc(size * 0.58, size * 0.76, size * 0.028, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

function folds(vertical: number, horizontal: number, diagonal: boolean): FoldState {
  return {
    vertical,
    horizontal,
    diagonal: {
      enabled: diagonal,
      count: diagonal ? 1 : 0,
      direction: 'topRightToBottomLeft',
    },
  };
}

function createContext(
  foldedCanvas: HTMLCanvasElement,
  unfoldedCanvas: HTMLCanvasElement
): CanvasContext {
  return {
    foldedCanvas,
    unfoldedCanvas,
    foldedCtx: get2DContext(foldedCanvas),
    unfoldedCtx: get2DContext(unfoldedCanvas),
  };
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function get2DContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D context is unavailable');
  return context;
}

function countWhiteInRegion(
  image: ImageData,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): number {
  let count = 0;
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const offset = (y * image.width + x) * 4;
      if (isWhite(image.data[offset], image.data[offset + 1], image.data[offset + 2])) count++;
    }
  }
  return count;
}

function countWhitePixels(image: ImageData): number {
  let count = 0;
  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (isWhite(image.data[offset], image.data[offset + 1], image.data[offset + 2])) count++;
  }
  return count;
}

function isWhite(red: number, green: number, blue: number): boolean {
  return red > 240 && green > 240 && blue > 240;
}
