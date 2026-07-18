import { State } from '../store/shiboriCanvasState';
import { DrawingTool, HistoryAction, ShapeFillMode } from '../types';
export interface Point {
    x: number;
    y: number;
}

export interface CanvasDimensions {
    width: number;
    height: number;
}

export interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export interface GeometryOptions {
    lineThickness: number;
    hitTolerance?: number;
}

export interface DrawingModeGeometry {
    hitTest: (item: DrawableHistoryItem, point: Point, options: GeometryOptions) => boolean;
    getBounds: (item: DrawableHistoryItem, options: GeometryOptions) => Bounds | null;
    translate: (item: DrawableHistoryItem, delta: Point) => DrawableHistoryItem;
}

export interface DrawingModeContext {
    getState: () => State;
    foldedCtx: CanvasRenderingContext2D
    foldedCanvas?: HTMLCanvasElement;
    getFoldedCanvasDimensions: () => CanvasDimensions | null;
    historyItem?: DrawableHistoryItem;
    setDrawingGuidance: (guidance: DrawingGuidance | null) => void;
}

export interface BezierDrawingGuidance {
    kind: 'bezier';
    path: BezierPath;
    hoverPoint?: Point;
    activeHandle?: Point;
}

export type DrawingGuidance = BezierDrawingGuidance;

export type DrawingModeResult =
    | { status: 'continue' }
    | { status: 'commit'; item: UndoableHistoryItem }
    | { status: 'discard' };

export type DrawableDrawingTool = Exclude<DrawingTool, DrawingTool.SelectMove | DrawingTool.DirectSelect>;
export type PointDrawingTool = Exclude<DrawableDrawingTool, DrawingTool.Bezier>;

export type BezierAnchorKind = 'corner' | 'smooth';

export interface BezierAnchor {
    id: string;
    point: Point;
    inHandle: Point | null;
    outHandle: Point | null;
    kind: BezierAnchorKind;
}

export interface BezierPath {
    anchors: BezierAnchor[];
    closed: boolean;
}

/**
 * Rendering values captured when a drawable is committed. Keeping these values
 * on the command makes replay independent of the currently selected controls.
 */
export interface DrawingStyle {
    lineThickness: number;
    color: string;
    shapeFillMode?: ShapeFillMode;
}

interface DrawableHistoryBase {
    id?: string;
    style?: DrawingStyle;
    /** @deprecated Read only for legacy, unversioned history. Use style.shapeFillMode. */
    shapeFillMode?: ShapeFillMode;
    rotation?: number;
    rotationCenter?: Point;
}

export interface PointDrawableHistoryItem extends DrawableHistoryBase {
    action: PointDrawingTool;
    points: Point[];
    path?: never;
}

export interface BezierPathHistoryItem extends DrawableHistoryBase {
    action: DrawingTool.Bezier;
    points: Point[];
    path: BezierPath;
}

export interface LegacyBezierHistoryItem extends DrawableHistoryBase {
    action: DrawingTool.Bezier;
    points: Point[];
    path?: never;
}

export type DrawableHistoryItem =
    | PointDrawableHistoryItem
    | BezierPathHistoryItem
    | LegacyBezierHistoryItem;

export interface ClearHistoryItem {
    id?: never;
    action: HistoryAction.Clear;
    points: [];
}

export interface TransformHistoryItem {
    id?: never;
    action: HistoryAction.Move | HistoryAction.Rotate;
    points: [];
    itemId: string;
    fromPoints: Point[];
    toPoints: Point[];
    fromRotation?: number;
    toRotation?: number;
    fromRotationCenter?: Point;
    toRotationCenter?: Point;
}

export interface DeleteHistoryItem {
    id?: never;
    action: HistoryAction.Delete;
    points: [];
    itemId: string;
}

export interface UpdatePathHistoryItem {
    id?: never;
    action: HistoryAction.UpdatePath;
    points: [];
    itemId: string;
    fromPath: BezierPath;
    toPath: BezierPath;
}

/**
 * The persisted operation log. Each action now exposes only the fields that are
 * meaningful for that command, while retaining the historical `points: []`
 * marker on non-drawing commands for share-link compatibility.
 */
export type UndoableHistoryItem =
    | DrawableHistoryItem
    | ClearHistoryItem
    | TransformHistoryItem
    | DeleteHistoryItem
    | UpdatePathHistoryItem;

export interface DrawingMode {
    start: (point: Point, context: DrawingModeContext) => void;
    continue: (point: Point, context: DrawingModeContext) => boolean;
    end: (point: Point | null, context: DrawingModeContext) => DrawingModeResult;
    cancel: (context: DrawingModeContext) => void;
    hover?: (point: Point, context: DrawingModeContext) => boolean;
    finish?: (context: DrawingModeContext) => DrawingModeResult;
} 
