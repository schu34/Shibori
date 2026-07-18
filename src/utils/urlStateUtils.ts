import type { State } from '../store/shiboriCanvasState';
import {
    DiagonalDirection,
    DrawingTool,
    FoldState,
    HistoryAction,
    ShapeFillMode,
} from '../types';
import {
    DrawingStyle,
    Point,
    UndoableHistoryItem,
} from '../types/DrawingMode';
import {
    isDrawableAction,
    isDrawableCommand,
    materializeDrawableStyles,
    resolveScene,
} from './historyOperations';
import { deflateSync, Inflate, strFromU8, strToU8 } from 'fflate';

export const SHARE_SCHEMA_VERSION = 2 as const;
export const SHARE_ENCODING_PREFIX = 'z3.';
export const MAX_SHARE_PARAMETER_LENGTH = 6 * 1024;
export const MAX_LEGACY_SHARE_PARAMETER_LENGTH = 100_000;
export const MAX_SHARE_DECOMPRESSED_BYTES = 2 * 1024 * 1024;
export const MAX_SHARE_HISTORY_ITEMS = 500;
export const MAX_SHARE_POINTS_PER_ITEM = 10_000;
export const MAX_SHARE_TOTAL_POINTS = 50_000;
export const MAX_SHARE_CANVAS_DIMENSION = 3_200;
export const MIN_SHARE_CANVAS_DIMENSION = 100;

const MAX_COLOR_LENGTH = 64;
const MAX_ID_LENGTH = 128;
const MAX_LINE_THICKNESS = 100;
const MAX_CIRCLE_RADIUS = 200;
const MAX_FOLDS = 3;
const LEGACY_DRAWING_COLOR = 'white';

/** The normalized, current share document returned to the application. */
export interface SerializableState {
    version: typeof SHARE_SCHEMA_VERSION;
    history: UndoableHistoryItem[];
    folds: FoldState;
    canvasDimensions: {
        width: number;
        height: number;
    };
    circleRadius: number;
    lineThickness: number;
    shapeFillMode: ShapeFillMode;
    currentTool: DrawingTool;
}

/** Allows existing callers to omit the version; encoding always writes v2. */
export type SerializableStateInput = Omit<SerializableState, 'version'> & {
    version?: typeof SHARE_SCHEMA_VERSION;
};

export type ShareEncodingResult =
    | {
        kind: 'success';
        encodedState: string;
        encodedLength: number;
    }
    | { kind: 'invalid-state' }
    | {
        kind: 'too-large';
        encodedLength: number;
        maxLength: number;
    };

export type ShareUrlResult =
    | {
        kind: 'success';
        url: string;
        encodedLength: number;
    }
    | { kind: 'invalid-state' }
    | {
        kind: 'too-large';
        encodedLength: number;
        maxLength: number;
    };

interface LegacySerializableState {
    history: UndoableHistoryItem[];
    folds: FoldState;
    canvasDimensions: SerializableState['canvasDimensions'];
    circleRadius: number;
    lineThickness: number;
    shapeFillMode?: ShapeFillMode;
    currentTool: DrawingTool;
}

export function extractSerializableState(state: State): SerializableState {
    return normalizeSerializableState({
        history: state.history,
        folds: state.folds,
        canvasDimensions: state.canvasDimensions,
        circleRadius: state.circleRadius,
        lineThickness: state.lineThickness,
        shapeFillMode: state.shapeFillMode,
        currentTool: state.currentTool,
    });
}

/** Encode a normalized v2 document using the compressed z3 wire format. */
export function encodeStateToUrl(state: SerializableStateInput): ShareEncodingResult {
    try {
        const normalized = normalizeSerializableState(state);
        if (!isValidSerializableStateV2(normalized)) return { kind: 'invalid-state' };

        const compressed = deflateSync(strToU8(JSON.stringify(normalized)), { level: 9 });
        const encodedState = `${SHARE_ENCODING_PREFIX}${encodeBase64Url(compressed)}`;

        if (encodedState.length > MAX_SHARE_PARAMETER_LENGTH) {
            return {
                kind: 'too-large',
                encodedLength: encodedState.length,
                maxLength: MAX_SHARE_PARAMETER_LENGTH,
            };
        }

        return {
            kind: 'success',
            encodedState,
            encodedLength: encodedState.length,
        };
    } catch (error) {
        console.error('Failed to encode state to URL:', error);
        return { kind: 'invalid-state' };
    }
}

/** Decode compressed z3/v2 documents and migrate original unversioned links to v2. */
export function decodeStateFromUrl(encodedState: string): SerializableState | null {
    try {
        if (encodedState.startsWith(SHARE_ENCODING_PREFIX)) {
            return decodeCompressedState(encodedState);
        }

        if (!isPlausibleBase64Url(encodedState)) return null;

        const parsed: unknown = JSON.parse(decodeBase64UrlToString(encodedState));
        if (isRecord(parsed) && parsed.version === SHARE_SCHEMA_VERSION) {
            return normalizeSerializableStateFromUnknown(parsed);
        }

        if (isRecord(parsed) && parsed.version !== undefined) return null;
        return migrateLegacySerializableState(parsed);
    } catch (error) {
        console.error('Failed to decode state from URL:', error);
        return null;
    }
}

/**
 * Validate and defensively clone an untrusted current-version share document.
 * URL decoding and Redux loading both use this boundary so their accepted
 * schema cannot drift apart.
 */
export function normalizeSerializableStateFromUnknown(
    value: unknown
): SerializableState | null {
    return isValidSerializableStateV2(value)
        ? canonicalizeV2State(value)
        : null;
}

export function isPlausibleBase64Url(param: unknown): param is string {
    if (typeof param !== 'string' || param.length === 0) return false;
    if (param.length > MAX_LEGACY_SHARE_PARAMETER_LENGTH) return false;
    if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(param)) return false;

    const withoutPadding = param.replace(/=+$/, '');
    return withoutPadding.length % 4 !== 1;
}

export function generateShareableUrl(
    state: SerializableStateInput,
    baseUrl: string = window.location.origin
): ShareUrlResult {
    const encoded = encodeShareableState(state);
    if (encoded.kind !== 'success') return encoded;

    const url = new URL(baseUrl);
    url.searchParams.set('shared', encoded.encodedState);
    return {
        kind: 'success',
        url: url.toString(),
        encodedLength: encoded.encodedLength,
    };
}

/** Prepare the exact compressed snapshot used by generated share links. */
export function encodeShareableState(state: SerializableStateInput): ShareEncodingResult {
    try {
        return encodeStateToUrl(createShareSnapshot(state));
    } catch (error) {
        console.error('Failed to create share snapshot:', error);
        return { kind: 'invalid-state' };
    }
}

function createShareSnapshot(state: SerializableStateInput): SerializableState {
    const normalized = normalizeSerializableState(state);
    return {
        ...normalized,
        // Shared links are editable snapshots of the visible scene. Resolving
        // here removes superseded transforms, deletions, and clear boundaries
        // without altering the pattern that will be replayed after loading.
        history: resolveScene(normalized.history),
    };
}

export function getSharedStateFromCurrentUrl(): SerializableState | null {
    const encodedState = new URLSearchParams(window.location.search).get('shared');
    return encodedState ? decodeStateFromUrl(encodedState) : null;
}

export function clearSharedParamFromUrl(): void {
    if (!window.history?.replaceState) return;

    const url = new URL(window.location.href);
    url.searchParams.delete('shared');
    window.history.replaceState({}, document.title, url.toString());
}

function migrateLegacySerializableState(value: unknown): SerializableState | null {
    if (!isValidLegacySerializableState(value)) return null;

    const shapeFillMode = value.shapeFillMode ?? ShapeFillMode.Filled;
    const migrated = normalizeSerializableState({
        ...value,
        shapeFillMode,
        history: materializeDrawableStyles(value.history, {
            lineThickness: value.lineThickness,
            color: LEGACY_DRAWING_COLOR,
            shapeFillMode,
        }),
    });

    return isValidSerializableStateV2(migrated) ? migrated : null;
}

function decodeCompressedState(encodedState: string): SerializableState | null {
    if (!isPlausibleCompressedShare(encodedState)) return null;

    const compressed = decodeBase64UrlToBytes(encodedState.slice(SHARE_ENCODING_PREFIX.length));
    const json = inflateCompressedJson(compressed);
    if (json === null) return null;

    const parsed: unknown = JSON.parse(json);
    return isRecord(parsed) && parsed.version === SHARE_SCHEMA_VERSION
        ? normalizeSerializableStateFromUnknown(parsed)
        : null;
}

function isPlausibleCompressedShare(param: unknown): param is string {
    if (typeof param !== 'string' || !param.startsWith(SHARE_ENCODING_PREFIX)) return false;
    if (param.length <= SHARE_ENCODING_PREFIX.length || param.length > MAX_SHARE_PARAMETER_LENGTH) {
        return false;
    }

    const payload = param.slice(SHARE_ENCODING_PREFIX.length);
    return /^[A-Za-z0-9_-]+$/.test(payload) && payload.length % 4 !== 1;
}

function inflateCompressedJson(compressed: Uint8Array): string | null {
    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    let completed = false;

    const inflater = new Inflate((chunk, final) => {
        totalLength += chunk.length;
        if (totalLength > MAX_SHARE_DECOMPRESSED_BYTES) {
            throw new Error('Compressed share state exceeds decompressed size limit');
        }
        chunks.push(chunk);
        completed = final;
    });
    inflater.push(compressed, true);

    if (!completed) return null;
    const output = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.length;
    }
    return strFromU8(output);
}

function encodeBase64Url(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function decodeBase64UrlToString(encoded: string): string {
    return atob(toPaddedBase64(encoded));
}

function decodeBase64UrlToBytes(encoded: string): Uint8Array {
    const binary = decodeBase64UrlToString(encoded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toPaddedBase64(encoded: string): string {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return base64;
}

function normalizeSerializableState(state: SerializableStateInput): SerializableState {
    const history = materializeDrawableStyles(state.history, {
        lineThickness: state.lineThickness,
        color: LEGACY_DRAWING_COLOR,
        shapeFillMode: state.shapeFillMode,
    }).map(canonicalizeHistoryItem);

    return {
        version: SHARE_SCHEMA_VERSION,
        history,
        folds: cloneFolds(state.folds),
        canvasDimensions: { ...state.canvasDimensions },
        circleRadius: state.circleRadius,
        lineThickness: state.lineThickness,
        shapeFillMode: state.shapeFillMode,
        currentTool: state.currentTool,
    };
}

function canonicalizeV2State(state: SerializableState): SerializableState {
    return {
        version: SHARE_SCHEMA_VERSION,
        history: state.history.map(canonicalizeHistoryItem),
        folds: cloneFolds(state.folds),
        canvasDimensions: { ...state.canvasDimensions },
        circleRadius: state.circleRadius,
        lineThickness: state.lineThickness,
        shapeFillMode: state.shapeFillMode,
        currentTool: state.currentTool,
    };
}

function canonicalizeHistoryItem(item: UndoableHistoryItem): UndoableHistoryItem {
    if (isDrawableCommand(item)) {
        return {
            id: item.id,
            action: item.action,
            points: item.points.map(clonePoint),
            style: item.style ? cloneStyle(item.style) : undefined,
            ...(item.rotation === undefined ? {} : { rotation: item.rotation }),
            ...(item.rotationCenter === undefined
                ? {}
                : { rotationCenter: clonePoint(item.rotationCenter) }),
        };
    }

    if (item.action === HistoryAction.Clear) {
        return { action: HistoryAction.Clear, points: [] };
    }

    if (item.action === HistoryAction.Delete) {
        return { action: HistoryAction.Delete, points: [], itemId: item.itemId };
    }

    return {
        action: item.action,
        points: [],
        itemId: item.itemId,
        fromPoints: item.fromPoints.map(clonePoint),
        toPoints: item.toPoints.map(clonePoint),
        ...(item.fromRotation === undefined ? {} : { fromRotation: item.fromRotation }),
        ...(item.toRotation === undefined ? {} : { toRotation: item.toRotation }),
        ...(item.fromRotationCenter === undefined
            ? {}
            : { fromRotationCenter: clonePoint(item.fromRotationCenter) }),
        ...(item.toRotationCenter === undefined
            ? {}
            : { toRotationCenter: clonePoint(item.toRotationCenter) }),
    };
}

function isValidSerializableStateV2(value: unknown): value is SerializableState {
    if (!isRecord(value) || value.version !== SHARE_SCHEMA_VERSION) return false;
    if (!isValidSharedStateFields(value, true)) return false;
    if (!value.history.every((item) => isValidHistoryItem(item, true))) return false;

    const ids = value.history
        .filter(isDrawableCommand)
        .map((item) => item.id);
    return new Set(ids).size === ids.length;
}

function isValidLegacySerializableState(value: unknown): value is LegacySerializableState {
    if (!isRecord(value) || !isValidSharedStateFields(value, false)) return false;
    return value.history.every((item) => isValidHistoryItem(item, false));
}

function isValidSharedStateFields(
    value: Record<string, unknown>,
    requireShapeFillMode: boolean
): value is Record<string, unknown> & LegacySerializableState {
    if (!Array.isArray(value.history) || value.history.length > MAX_SHARE_HISTORY_ITEMS) return false;
    if (!isValidFolds(value.folds) || !isValidCanvasDimensions(value.canvasDimensions)) return false;
    if (!isFiniteInRange(value.circleRadius, 1, MAX_CIRCLE_RADIUS)) return false;
    if (!isFiniteInRange(value.lineThickness, 1, MAX_LINE_THICKNESS)) return false;
    if (requireShapeFillMode && !isShapeFillMode(value.shapeFillMode)) return false;
    if (value.shapeFillMode !== undefined && !isShapeFillMode(value.shapeFillMode)) return false;
    if (!Object.values(DrawingTool).includes(value.currentTool as DrawingTool)) return false;

    let totalPoints = 0;
    for (const item of value.history) {
        if (!isRecord(item)) return false;
        for (const field of ['points', 'fromPoints', 'toPoints']) {
            const points = item[field];
            if (Array.isArray(points)) totalPoints += points.length;
        }
        if (totalPoints > MAX_SHARE_TOTAL_POINTS) return false;
    }
    return true;
}

function isValidHistoryItem(value: unknown, requireV2Style: boolean): value is UndoableHistoryItem {
    if (!isRecord(value) || !Array.isArray(value.points)) return false;
    if (value.points.length > MAX_SHARE_POINTS_PER_ITEM || !areValidPoints(value.points)) return false;

    const action = value.action as UndoableHistoryItem['action'];
    if (isDrawableAction(action)) {
        if (requireV2Style && !hasOnlyKeys(value, [
            'id',
            'action',
            'points',
            'style',
            'rotation',
            'rotationCenter',
        ])) return false;
        const minimumPoints = action === DrawingTool.Paintbrush ? 1 : 2;
        if (value.points.length < minimumPoints) return false;
        if (action === DrawingTool.Bezier && value.points.length !== 4) return false;
        if (requireV2Style && !isValidId(value.id)) return false;
        if (value.id !== undefined && !isValidId(value.id)) return false;
        if (requireV2Style && !isValidDrawingStyle(value.style, isShapeAction(action), true)) return false;
        if (value.style !== undefined &&
            !isValidDrawingStyle(value.style, isShapeAction(action), requireV2Style)) return false;
        if (value.shapeFillMode !== undefined && !isShapeFillMode(value.shapeFillMode)) return false;
        if (value.rotation !== undefined && !Number.isFinite(value.rotation)) return false;
        if (value.rotationCenter !== undefined && !isValidPoint(value.rotationCenter)) return false;
        return true;
    }

    if (action === HistoryAction.Clear) {
        if (requireV2Style && !hasOnlyKeys(value, ['action', 'points'])) return false;
        return value.points.length === 0 && !hasAny(value, ['itemId', 'fromPoints', 'toPoints', 'style']);
    }

    if (action === HistoryAction.Delete) {
        if (requireV2Style && !hasOnlyKeys(value, ['action', 'points', 'itemId'])) return false;
        return value.points.length === 0 && isValidId(value.itemId) &&
            !hasAny(value, ['fromPoints', 'toPoints', 'style']);
    }

    if (action === HistoryAction.Move || action === HistoryAction.Rotate) {
        if (requireV2Style && !hasOnlyKeys(value, [
            'action',
            'points',
            'itemId',
            'fromPoints',
            'toPoints',
            'fromRotation',
            'toRotation',
            'fromRotationCenter',
            'toRotationCenter',
        ])) return false;
        if (value.points.length !== 0 || !isValidId(value.itemId)) return false;
        if (!areValidPoints(value.fromPoints) || !areValidPoints(value.toPoints)) return false;
        if (value.fromPoints.length === 0 || value.toPoints.length === 0) return false;
        if (value.fromPoints.length !== value.toPoints.length) return false;
        if (value.fromRotation !== undefined && !Number.isFinite(value.fromRotation)) return false;
        if (value.toRotation !== undefined && !Number.isFinite(value.toRotation)) return false;
        if (value.fromRotationCenter !== undefined && !isValidPoint(value.fromRotationCenter)) return false;
        if (value.toRotationCenter !== undefined && !isValidPoint(value.toRotationCenter)) return false;
        return !hasAny(value, ['style', 'shapeFillMode', 'rotation', 'rotationCenter']);
    }

    return false;
}

function isValidDrawingStyle(
    value: unknown,
    requireFillMode: boolean,
    requireExactShape: boolean
): value is DrawingStyle {
    if (!isRecord(value)) return false;
    if (requireExactShape && !hasOnlyKeys(value, [
        'lineThickness',
        'color',
        ...(requireFillMode ? ['shapeFillMode'] : []),
    ])) return false;
    if (!isFiniteInRange(value.lineThickness, 1, MAX_LINE_THICKNESS)) return false;
    if (typeof value.color !== 'string' || value.color.length === 0 || value.color.length > MAX_COLOR_LENGTH) {
        return false;
    }
    if (requireFillMode && !isShapeFillMode(value.shapeFillMode)) return false;
    if (requireExactShape && !requireFillMode && value.shapeFillMode !== undefined) return false;
    return value.shapeFillMode === undefined || isShapeFillMode(value.shapeFillMode);
}

function isValidFolds(value: unknown): value is FoldState {
    if (!isRecord(value) || !isRecord(value.diagonal)) return false;
    return isIntegerInRange(value.vertical, 0, MAX_FOLDS) &&
        isIntegerInRange(value.horizontal, 0, MAX_FOLDS) &&
        typeof value.diagonal.enabled === 'boolean' &&
        isIntegerInRange(value.diagonal.count, 0, 1) &&
        Object.values(DiagonalDirection).includes(
            value.diagonal.direction as DiagonalDirection
        );
}

function isValidCanvasDimensions(value: unknown): value is SerializableState['canvasDimensions'] {
    if (!isRecord(value)) return false;
    return isIntegerInRange(value.width, MIN_SHARE_CANVAS_DIMENSION, MAX_SHARE_CANVAS_DIMENSION) &&
        isIntegerInRange(value.height, MIN_SHARE_CANVAS_DIMENSION, MAX_SHARE_CANVAS_DIMENSION);
}

function areValidPoints(value: unknown): value is Point[] {
    return Array.isArray(value) && value.length <= MAX_SHARE_POINTS_PER_ITEM && value.every(isValidPoint);
}

function isValidPoint(value: unknown): value is Point {
    return isRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function isShapeAction(action: UndoableHistoryItem['action']): boolean {
    return action === DrawingTool.Rectangle ||
        action === DrawingTool.Square ||
        action === DrawingTool.Circle;
}

function isShapeFillMode(value: unknown): value is ShapeFillMode {
    return Object.values(ShapeFillMode).includes(value as ShapeFillMode);
}

function isValidId(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

function isFiniteInRange(value: unknown, min: number, max: number): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
    return isFiniteInRange(value, min, max) && Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasAny(value: Record<string, unknown>, fields: string[]): boolean {
    return fields.some((field) => value[field] !== undefined);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
    const allowed = new Set(allowedKeys);
    return Object.keys(value).every((key) => allowed.has(key));
}

function clonePoint(point: Point): Point {
    return { x: point.x, y: point.y };
}

function cloneStyle(style: DrawingStyle): DrawingStyle {
    return {
        lineThickness: style.lineThickness,
        color: style.color,
        ...(style.shapeFillMode === undefined ? {} : { shapeFillMode: style.shapeFillMode }),
    };
}

function cloneFolds(folds: FoldState): FoldState {
    return {
        vertical: folds.vertical,
        horizontal: folds.horizontal,
        diagonal: { ...folds.diagonal },
    };
}
