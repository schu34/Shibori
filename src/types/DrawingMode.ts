import { State, Action } from '../store/shiboriCanvasState';
import { DrawingTool, ShapeFillMode } from '../types';
export interface Point {
    x: number;
    y: number;
}

export interface CanvasDimensions {
    width: number;
    height: number;
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
    action: DrawingTool;
    points: Point[];
    shapeFillMode?: ShapeFillMode;
}

export interface DrawingMode {
    start: (point: Point, context: DrawingModeContext) => void;
    continue: (point: Point, context: DrawingModeContext) => boolean;
    end: (point: Point| null, context: DrawingModeContext) => UndoableHistoryItem | null;
    cancel: (context: DrawingModeContext) => void;
} 
