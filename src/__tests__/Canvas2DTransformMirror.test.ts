import { renderUnfoldedCanvas } from '../rendering/CanvasMirror';
import type { CanvasContext, FoldState } from '../services/CanvasService';

interface ContextRecorder {
  transforms: Array<[number, number, number, number, number, number]>;
  drawImageCalls: number;
  context: CanvasRenderingContext2D;
}

describe('CanvasMirror', () => {
  const recorders = new WeakMap<HTMLCanvasElement, ContextRecorder>();
  const allRecorders: ContextRecorder[] = [];

  beforeEach(() => {
    allRecorders.length = 0;
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      let recorder = recorders.get(this);
      if (!recorder) {
        recorder = createRecorder(this);
        recorders.set(this, recorder);
        allRecorders.push(recorder);
      }
      return recorder.context;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses the intended anti-diagonal and alternating grid transforms', () => {
    const foldedCanvas = document.createElement('canvas');
    const unfoldedCanvas = document.createElement('canvas');
    foldedCanvas.width = unfoldedCanvas.width = 128;
    foldedCanvas.height = unfoldedCanvas.height = 128;
    const context: CanvasContext = {
      foldedCanvas,
      unfoldedCanvas,
      foldedCtx: contextFor(foldedCanvas),
      unfoldedCtx: contextFor(unfoldedCanvas),
    };

    const folds: FoldState = {
      vertical: 1,
      horizontal: 1,
      diagonal: {
        enabled: true,
        count: 1,
        direction: 'topRightToBottomLeft',
      },
    };

    renderUnfoldedCanvas(context, folds);

    const targetTransforms = recorderFor(unfoldedCanvas).transforms;
    expect(targetTransforms).toContainEqual([1, 0, 0, 1, 0, 0]);
    expect(targetTransforms).toContainEqual([-1, 0, 0, 1, 128, 0]);
    expect(targetTransforms).toContainEqual([1, 0, 0, -1, 0, 128]);
    expect(targetTransforms).toContainEqual([-1, 0, 0, -1, 128, 128]);

    expect(allRecorders.some((recorder) =>
      recorder.transforms.some((transform) =>
        transform.join(',') === [0, -1, -1, 0, 64, 64].join(',')
      )
    )).toBe(true);
  });

  test('uses the intended main-diagonal reflection transform', () => {
    const foldedCanvas = document.createElement('canvas');
    const unfoldedCanvas = document.createElement('canvas');
    foldedCanvas.width = unfoldedCanvas.width = 128;
    foldedCanvas.height = unfoldedCanvas.height = 128;
    const context: CanvasContext = {
      foldedCanvas,
      unfoldedCanvas,
      foldedCtx: contextFor(foldedCanvas),
      unfoldedCtx: contextFor(unfoldedCanvas),
    };

    renderUnfoldedCanvas(context, {
      vertical: 0,
      horizontal: 0,
      diagonal: {
        enabled: true,
        count: 1,
        direction: 'topLeftToBottomRight',
      },
    });

    expect(allRecorders.some((recorder) =>
      recorder.transforms.some((transform) =>
        transform.join(',') === [0, 1, 1, 0, 0, 0].join(',')
      )
    )).toBe(true);
  });

  function contextFor(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    return canvas.getContext('2d') as CanvasRenderingContext2D;
  }

  function recorderFor(canvas: HTMLCanvasElement): ContextRecorder {
    const recorder = recorders.get(canvas);
    if (!recorder) throw new Error('Missing context recorder');
    return recorder;
  }
});

function createRecorder(canvas: HTMLCanvasElement): ContextRecorder {
  const recorder = {
    transforms: [] as Array<[number, number, number, number, number, number]>,
    drawImageCalls: 0,
    context: null as unknown as CanvasRenderingContext2D,
  };

  recorder.context = {
    canvas,
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    clip: jest.fn(),
    drawImage: jest.fn(() => { recorder.drawImageCalls++; }),
    setTransform: jest.fn((...transform: [number, number, number, number, number, number]) => {
      recorder.transforms.push(transform);
    }),
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;

  return recorder;
}
