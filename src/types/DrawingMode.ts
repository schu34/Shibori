import { State, Action } from '../store/shiboriCanvasState';

export interface Point {
    x: number;
    y: number;
}

export interface CanvasDimensions {
    width: number;
    height: number;
}

export interface DrawingModeContext {
    state: State;
    dispatch: React.Dispatch<Action>;
    foldedCtx: CanvasRenderingContext2D
    unfoldedCtx: CanvasRenderingContext2D
    getFoldedCanvasDimensions: () => CanvasDimensions | null;
    getUnfoldedCanvasDimensions: () => CanvasDimensions | null;
    updateUnfoldedCanvas: () => void;
    drawDiagonalFoldLinesOnFolded: () => void;
    isInValidDrawingArea: (x: number, y: number) => boolean;
}

export interface DrawingMode {
    start: (point: Point, context: DrawingModeContext) => void;
    continue: (point: Point, context: DrawingModeContext) => void;
    end: (point: Point, context: DrawingModeContext) => void;
    cancel: (context: DrawingModeContext) => void;
} 