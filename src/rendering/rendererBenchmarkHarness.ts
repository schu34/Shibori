import { CanvasService } from '../services/CanvasService';
import type { CanvasContext, FoldState } from '../services/CanvasService';
import { WebGLCanvasService } from '../services/WebGLCanvasService';
import { renderCanvas2DTransformMirror } from './Canvas2DTransformMirror';

export type BenchmarkRenderer = 'canvas2d-imagedata' | 'canvas2d-transform' | 'webgl';

export interface RendererBenchmarkScenario {
  name: string;
  size: number;
  folds: FoldState;
  iterations: number;
}

export interface RendererTiming {
  renderer: BenchmarkRenderer;
  supported: boolean;
  samplesMs: number[];
  meanMs: number | null;
  minMs: number | null;
  maxMs: number | null;
}

export interface RendererMaskComparison {
  left: BenchmarkRenderer;
  right: BenchmarkRenderer;
  leftWhitePixels: number;
  rightWhitePixels: number;
  intersectionPixels: number;
  unionPixels: number;
  similarity: number;
}

export interface RendererBenchmarkResult {
  scenario: RendererBenchmarkScenario;
  timings: RendererTiming[];
  comparisons: RendererMaskComparison[];
}

export interface DiagonalProbeResult {
  renderer: BenchmarkRenderer;
  supported: boolean;
  sourceRegionWhitePixels: number;
  expectedMirrorRegionWhitePixels: number;
  verticallyFlippedSourceRegionWhitePixels: number;
  verticallyFlippedMirrorRegionWhitePixels: number;
  totalWhitePixels: number;
}

export interface RendererEvidence {
  userAgent: string;
  generatedAt: string;
  benchmarks: RendererBenchmarkResult[];
  diagonalProbe: DiagonalProbeResult[];
}

const renderers: BenchmarkRenderer[] = [
  'canvas2d-imagedata',
  'canvas2d-transform',
  'webgl',
];

export function defaultRendererBenchmarkScenarios(): RendererBenchmarkScenario[] {
  return [800, 1600, 3200].flatMap((size) => {
    const iterations = size === 800 ? 3 : size === 1600 ? 2 : 1;
    return [
      {
        name: `${size}-no-folds`,
        size,
        iterations,
        folds: folds(0, 0, false),
      },
      {
        name: `${size}-default-diagonal`,
        size,
        iterations,
        folds: folds(1, 1, true),
      },
      {
        name: `${size}-max-grid-diagonal`,
        size,
        iterations,
        folds: folds(3, 3, true),
      },
    ];
  });
}

/**
 * Browser-only benchmark entrypoint. It is intentionally not called by the
 * production application; invoke it from the opt-in Playwright spec or a Vite
 * development page console.
 */
export async function runRendererEvidence(
  scenarios = defaultRendererBenchmarkScenarios()
): Promise<RendererEvidence> {
  const benchmarks: RendererBenchmarkResult[] = [];

  try {
    for (const scenario of scenarios) {
      benchmarks.push(await benchmarkScenario(scenario));
    }

    return {
      userAgent: navigator.userAgent,
      generatedAt: new Date().toISOString(),
      benchmarks,
      diagonalProbe: await runDiagonalSemanticsProbe(),
    };
  } finally {
    WebGLCanvasService.dispose();
  }
}

async function benchmarkScenario(
  scenario: RendererBenchmarkScenario
): Promise<RendererBenchmarkResult> {
  const foldedCanvas = createFoldedFixture(scenario.size);
  const targets = new Map<BenchmarkRenderer, HTMLCanvasElement>();
  const timings: RendererTiming[] = [];

  for (const renderer of renderers) {
    const target = createCanvas(scenario.size, scenario.size);
    targets.set(renderer, target);
    const context = createContext(foldedCanvas, target);
    const render = () => renderWith(renderer, context, scenario.folds);

    // One warm-up is important for both shader compilation and JIT. It is not
    // included in the reported sample.
    const supported = render();
    const samplesMs: number[] = [];

    if (supported) {
      for (let iteration = 0; iteration < scenario.iterations; iteration++) {
        const startedAt = performance.now();
        if (!render()) break;
        samplesMs.push(performance.now() - startedAt);
      }
    }

    timings.push(toTiming(renderer, supported && samplesMs.length > 0, samplesMs));
  }

  const masks = new Map<BenchmarkRenderer, Uint8Array>();
  for (const [renderer, target] of targets) {
    masks.set(renderer, captureWhiteMask(target));
  }

  const comparisons: RendererMaskComparison[] = [
    compareMasks('canvas2d-imagedata', 'canvas2d-transform', masks),
    compareMasks('canvas2d-imagedata', 'webgl', masks),
    compareMasks('canvas2d-transform', 'webgl', masks),
  ];

  return { scenario, timings, comparisons };
}

async function runDiagonalSemanticsProbe(): Promise<DiagonalProbeResult[]> {
  const size = 64;
  const foldedCanvas = createCanvas(size, size);
  const foldedCtx = get2DContext(foldedCanvas);
  foldedCtx.fillStyle = 'navy';
  foldedCtx.fillRect(0, 0, size, size);
  foldedCtx.fillStyle = 'white';
  // Asymmetric marker wholly inside the lower-right drawable triangle.
  foldedCtx.fillRect(46, 40, 5, 3);

  const diagonalFolds = folds(0, 0, true);
  const results: DiagonalProbeResult[] = [];

  for (const renderer of renderers) {
    const target = createCanvas(size, size);
    const supported = renderWith(renderer, createContext(foldedCanvas, target), diagonalFolds);
    const image = get2DContext(target).getImageData(0, 0, size, size);

    results.push({
      renderer,
      supported,
      sourceRegionWhitePixels: countWhiteInRegion(image, 44, 38, 53, 45),
      expectedMirrorRegionWhitePixels: countWhiteInRegion(image, 17, 11, 24, 20),
      verticallyFlippedSourceRegionWhitePixels: countWhiteInRegion(image, 44, 19, 53, 26),
      verticallyFlippedMirrorRegionWhitePixels: countWhiteInRegion(image, 17, 44, 24, 53),
      totalWhitePixels: countWhitePixels(image),
    });
  }

  return results;
}

function renderWith(
  renderer: BenchmarkRenderer,
  context: CanvasContext,
  foldState: FoldState
): boolean {
  switch (renderer) {
    case 'canvas2d-imagedata':
      CanvasService.updateUnfoldedCanvas(context, foldState);
      return true;
    case 'canvas2d-transform':
      renderCanvas2DTransformMirror(context, foldState);
      return true;
    case 'webgl':
      return WebGLCanvasService.updateUnfoldedCanvasWebGL(context, foldState);
  }
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

  // All marks are in the default anti-diagonal fold's drawable triangle.
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

function captureWhiteMask(canvas: HTMLCanvasElement): Uint8Array {
  const image = get2DContext(canvas).getImageData(0, 0, canvas.width, canvas.height);
  const mask = new Uint8Array(image.width * image.height);
  for (let pixel = 0; pixel < mask.length; pixel++) {
    const offset = pixel * 4;
    mask[pixel] = isWhite(image.data[offset], image.data[offset + 1], image.data[offset + 2]) ? 1 : 0;
  }
  return mask;
}

function compareMasks(
  left: BenchmarkRenderer,
  right: BenchmarkRenderer,
  masks: Map<BenchmarkRenderer, Uint8Array>
): RendererMaskComparison {
  const leftMask = masks.get(left);
  const rightMask = masks.get(right);
  if (!leftMask || !rightMask || leftMask.length !== rightMask.length) {
    throw new Error(`Cannot compare ${left} and ${right}`);
  }

  let leftWhitePixels = 0;
  let rightWhitePixels = 0;
  let intersectionPixels = 0;
  let unionPixels = 0;

  for (let index = 0; index < leftMask.length; index++) {
    const leftSet = leftMask[index] === 1;
    const rightSet = rightMask[index] === 1;
    if (leftSet) leftWhitePixels++;
    if (rightSet) rightWhitePixels++;
    if (leftSet && rightSet) intersectionPixels++;
    if (leftSet || rightSet) unionPixels++;
  }

  return {
    left,
    right,
    leftWhitePixels,
    rightWhitePixels,
    intersectionPixels,
    unionPixels,
    similarity: unionPixels === 0 ? 1 : intersectionPixels / unionPixels,
  };
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

function toTiming(
  renderer: BenchmarkRenderer,
  supported: boolean,
  samplesMs: number[]
): RendererTiming {
  if (!supported || samplesMs.length === 0) {
    return { renderer, supported: false, samplesMs, meanMs: null, minMs: null, maxMs: null };
  }

  return {
    renderer,
    supported: true,
    samplesMs,
    meanMs: samplesMs.reduce((sum, value) => sum + value, 0) / samplesMs.length,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
  };
}
