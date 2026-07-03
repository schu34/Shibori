import { State, Action } from '../store/shiboriCanvasState';
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
    hitTest: (item: UndoableHistoryItem, point: Point, options: GeometryOptions) => boolean;
    getBounds: (item: UndoableHistoryItem, options: GeometryOptions) => Bounds | null;
    translate: (item: UndoableHistoryItem, delta: Point) => UndoableHistoryItem;
}

export interface DrawingModeContext {
    getState: () => State;
    dispatch: React.Dispatch<Action>;
    foldedCtx: CanvasRenderingContext2D
    unfoldedCtx: CanvasRenderingContext2D
    foldedCanvas?: HTMLCanvasElement;
    getFoldedCanvasDimensions: () => CanvasDimensions | null;
    getUnfoldedCanvasDimensions: () => CanvasDimensions | null;
    updateUnfoldedCanvas: () => void;
    drawDiagonalFoldLinesOnFolded: () => void;
    isInValidDrawingArea: (x: number, y: number) => boolean;
    historyItem?: UndoableHistoryItem;
}

export interface UndoableHistoryItem {
    id?: string;
    action: DrawingTool | HistoryAction;
    points: Point[];
    shapeFillMode?: ShapeFillMode;
    itemId?: string;
    fromPoints?: Point[];
    toPoints?: Point[];
}

export interface DrawingMode {
    start: (point: Point, context: DrawingModeContext) => void;
    continue: (point: Point, context: DrawingModeContext) => boolean;
    end: (point: Point| null, context: DrawingModeContext) => UndoableHistoryItem | null;
    cancel: (context: DrawingModeContext) => void;
} 
