import { initialState } from '../store/shiboriCanvasState';
import { DrawingTool, HistoryAction, ShapeFillMode } from '../types';
import { UndoableHistoryItem } from '../types/DrawingMode';
import {
  decodeStateFromUrl,
  encodeStateToUrl,
  extractSerializableState,
  isPlausibleBase64Url,
  MAX_SHARE_HISTORY_ITEMS,
  SHARE_SCHEMA_VERSION,
  SerializableState,
  SerializableStateInput,
} from '../utils/urlStateUtils';

const style = { lineThickness: 12, color: '#fafafa' };

const allCommands: UndoableHistoryItem[] = [
  { id: 'brush', action: DrawingTool.Paintbrush, points: [{ x: 1, y: 2 }], style },
  { id: 'line', action: DrawingTool.Line, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], style },
  {
    id: 'rectangle',
    action: DrawingTool.Rectangle,
    points: [{ x: 5, y: 6 }, { x: 20, y: 30 }],
    style: { ...style, shapeFillMode: ShapeFillMode.Filled },
  },
  {
    id: 'square',
    action: DrawingTool.Square,
    points: [{ x: 7, y: 8 }, { x: 40, y: 50 }],
    style: { ...style, shapeFillMode: ShapeFillMode.Outline },
    rotation: 0.25,
    rotationCenter: { x: 10, y: 10 },
  },
  {
    id: 'circle',
    action: DrawingTool.Circle,
    points: [{ x: 50, y: 50 }, { x: 75, y: 50 }],
    style: { ...style, shapeFillMode: ShapeFillMode.Filled },
  },
  {
    action: HistoryAction.Move,
    points: [],
    itemId: 'line',
    fromPoints: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
    toPoints: [{ x: 11, y: 12 }, { x: 13, y: 14 }],
  },
  {
    action: HistoryAction.Rotate,
    points: [],
    itemId: 'square',
    fromPoints: [{ x: 7, y: 8 }, { x: 40, y: 50 }],
    toPoints: [{ x: 7, y: 8 }, { x: 40, y: 50 }],
    fromRotation: 0.25,
    toRotation: 0.5,
    fromRotationCenter: { x: 10, y: 10 },
    toRotationCenter: { x: 10, y: 10 },
  },
  { action: HistoryAction.Delete, points: [], itemId: 'brush' },
  { action: HistoryAction.Clear, points: [] },
];

function makeState(history: UndoableHistoryItem[] = allCommands): SerializableState {
  return {
    version: SHARE_SCHEMA_VERSION,
    history,
    folds: initialState.folds,
    canvasDimensions: initialState.canvasDimensions,
    circleRadius: initialState.circleRadius,
    lineThickness: initialState.lineThickness,
    shapeFillMode: initialState.shapeFillMode,
    currentTool: initialState.currentTool,
  };
}

function encodeUnknown(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

describe('versioned share state', () => {
  test('round trips every command type through schema v2', () => {
    const decoded = decodeStateFromUrl(encodeStateToUrl(makeState()));

    expect(decoded).toEqual(makeState());
  });

  test('extracts stable IDs and deterministic styles from current legacy runtime history', () => {
    const extracted = extractSerializableState({
      ...initialState,
      lineThickness: 33,
      shapeFillMode: ShapeFillMode.Outline,
      history: [
        { action: DrawingTool.Line, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
        {
          action: DrawingTool.Circle,
          points: [{ x: 5, y: 5 }, { x: 10, y: 5 }],
          shapeFillMode: ShapeFillMode.Filled,
        },
      ],
    });

    expect(extracted.version).toBe(SHARE_SCHEMA_VERSION);
    expect(extracted.history).toEqual([
      expect.objectContaining({
        id: 'history-item-1',
        style: { lineThickness: 33, color: 'white' },
      }),
      expect.objectContaining({
        id: 'history-item-2',
        style: {
          lineThickness: 33,
          color: 'white',
          shapeFillMode: ShapeFillMode.Filled,
        },
      }),
    ]);
  });

  test('migrates an unversioned link using its top-level style defaults', () => {
    const legacy: Omit<SerializableStateInput, 'version'> = {
      history: [
        { action: DrawingTool.Paintbrush, points: [{ x: 1, y: 1 }] },
        {
          action: DrawingTool.Rectangle,
          points: [{ x: 1, y: 1 }, { x: 4, y: 5 }],
          shapeFillMode: ShapeFillMode.Filled,
        },
      ],
      folds: initialState.folds,
      canvasDimensions: initialState.canvasDimensions,
      circleRadius: 40,
      lineThickness: 27,
      shapeFillMode: ShapeFillMode.Outline,
      currentTool: DrawingTool.Line,
    };

    const decoded = decodeStateFromUrl(encodeUnknown(legacy));

    expect(decoded).toEqual(expect.objectContaining({
      version: SHARE_SCHEMA_VERSION,
      lineThickness: 27,
      shapeFillMode: ShapeFillMode.Outline,
    }));
    expect(decoded?.history[0]).toEqual(expect.objectContaining({
      id: 'history-item-1',
      style: { lineThickness: 27, color: 'white' },
    }));
    expect(decoded?.history[1]).toEqual(expect.objectContaining({
      id: 'history-item-2',
      style: {
        lineThickness: 27,
        color: 'white',
        shapeFillMode: ShapeFillMode.Filled,
      },
    }));
  });

  test('defaults missing legacy shape fill to the historical filled behavior', () => {
    const state = makeState([]);
    const legacy = {
      history: state.history,
      folds: state.folds,
      canvasDimensions: state.canvasDimensions,
      circleRadius: state.circleRadius,
      lineThickness: state.lineThickness,
      currentTool: state.currentTool,
    };

    const decoded = decodeStateFromUrl(encodeUnknown(legacy));

    expect(decoded?.shapeFillMode).toBe(ShapeFillMode.Filled);
  });

  test.each([
    ['non-finite dimensions', { ...makeState(), canvasDimensions: { width: null, height: 500 } }],
    ['unsupported schema', { ...makeState(), version: 99 }],
    ['duplicate drawable IDs', makeState([
      { id: 'same', action: DrawingTool.Paintbrush, points: [{ x: 1, y: 1 }], style },
      { id: 'same', action: DrawingTool.Paintbrush, points: [{ x: 2, y: 2 }], style },
    ])],
    ['malformed delete', { ...makeState(), history: [
      { action: HistoryAction.Delete, points: [], itemId: 'brush', style },
    ] }],
  ])('rejects %s', (_label, value) => {
    expect(decodeStateFromUrl(encodeUnknown(value))).toBeNull();
  });

  test.each([
    ['drawable fields from a transform', {
      ...allCommands[1],
      itemId: 'line',
      fromPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    }],
    ['non-shape drawable fill mode', {
      ...allCommands[1],
      style: { ...style, shapeFillMode: ShapeFillMode.Filled },
    }],
    ['clear drawable identity', {
      action: HistoryAction.Clear,
      points: [],
      id: 'not-a-drawable',
    }],
    ['clear rotation metadata', {
      action: HistoryAction.Clear,
      points: [],
      rotation: 0.5,
      shapeFillMode: ShapeFillMode.Filled,
    }],
    ['delete drawable metadata', {
      action: HistoryAction.Delete,
      points: [],
      itemId: 'brush',
      rotation: 0.5,
    }],
    ['transform drawable identity', {
      action: HistoryAction.Move,
      points: [],
      id: 'operation-id',
      itemId: 'line',
      fromPoints: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
      toPoints: [{ x: 11, y: 12 }, { x: 13, y: 14 }],
    }],
    ['transform geometry length mismatch', {
      action: HistoryAction.Rotate,
      points: [],
      itemId: 'line',
      fromPoints: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
      toPoints: [{ x: 11, y: 12 }],
    }],
  ])('rejects v2 command with %s', (_label, invalidCommand) => {
    expect(decodeStateFromUrl(encodeUnknown({
      ...makeState(),
      history: [invalidCommand],
    }))).toBeNull();
  });

  test('rejects oversized history and invalid numeric input before encoding', () => {
    const tooManyClears = Array.from(
      { length: MAX_SHARE_HISTORY_ITEMS + 1 },
      (): UndoableHistoryItem => ({ action: HistoryAction.Clear, points: [] })
    );

    expect(encodeStateToUrl(makeState(tooManyClears))).toBe('');
    expect(encodeStateToUrl({
      ...makeState(),
      lineThickness: Number.NaN,
    })).toBe('');
  });

  test('recognizes URL-safe Base64 characters and rejects malformed or oversized input', () => {
    expect(isPlausibleBase64Url(`A_${'b'.repeat(49)}`)).toBe(true);
    expect(isPlausibleBase64Url('not base64!')).toBe(false);
    expect(isPlausibleBase64Url('A')).toBe(false);
  });
});
