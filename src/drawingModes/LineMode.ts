import { DrawingMode, Point, DrawingModeContext } from '../types/DrawingMode';
import { ActionType } from '../store/shiboriCanvasState';

export class LineMode implements DrawingMode {
    private originalFoldedCanvasState: ImageData | null = null;
    private originalUnfoldedCanvasState: ImageData | null = null;

    start(point: Point, context: DrawingModeContext): void {
        const { dispatch, foldedCtx, unfoldedCtx, getFoldedCanvasDimensions, getUnfoldedCanvasDimensions } = context;

        // Store canvas states for preview
        const foldedDimensions = getFoldedCanvasDimensions();
        const unfoldedDimensions = getUnfoldedCanvasDimensions();

        if (foldedDimensions) {
            this.originalFoldedCanvasState = foldedCtx.getImageData(0, 0, foldedDimensions.width, foldedDimensions.height);
        }

        if (unfoldedDimensions) {
            this.originalUnfoldedCanvasState = unfoldedCtx.getImageData(0, 0, unfoldedDimensions.width, unfoldedDimensions.height);
        }

        dispatch({ type: ActionType.SET_LINE_START_POINT, payload: point });
        dispatch({ type: ActionType.SET_IS_DRAWING, payload: true });
    }

    continue(point: Point, context: DrawingModeContext): boolean {
        const { state, foldedCtx, unfoldedCtx, drawDiagonalFoldLinesOnFolded } = context;

        if (!state.isDrawing || !state.lineStartPoint) return;

        // Restore original states
        if (this.originalFoldedCanvasState) {
            foldedCtx.putImageData(this.originalFoldedCanvasState, 0, 0);
        }
        if (this.originalUnfoldedCanvasState) {
            unfoldedCtx.putImageData(this.originalUnfoldedCanvasState, 0, 0);
        }

        // Draw preview line
        foldedCtx.beginPath();
        foldedCtx.moveTo(state.lineStartPoint.x, state.lineStartPoint.y);
        foldedCtx.lineTo(point.x, point.y);
        foldedCtx.strokeStyle = state.config.lineColor;
        foldedCtx.lineWidth = state.lineThickness;
        foldedCtx.globalAlpha = 0.6;
        foldedCtx.stroke();
        foldedCtx.globalAlpha = 1.0;

        drawDiagonalFoldLinesOnFolded();
    }

    end(point: Point, context: DrawingModeContext): boolean {
        const { state, dispatch, foldedCtx, isInValidDrawingArea, drawDiagonalFoldLinesOnFolded } = context;

        if (!state.isDrawing || !state.lineStartPoint) return;

        const startValid = isInValidDrawingArea(state.lineStartPoint.x, state.lineStartPoint.y);
        const endValid = isInValidDrawingArea(point.x, point.y);

        if (!startValid && !endValid) {
            this.cancel(context);
            return false;
        }

        // Draw final line
        foldedCtx.beginPath();
        foldedCtx.moveTo(state.lineStartPoint.x, state.lineStartPoint.y);
        foldedCtx.lineTo(point.x, point.y);
        foldedCtx.strokeStyle = state.config.lineColor;
        foldedCtx.lineWidth = state.lineThickness;
        foldedCtx.stroke();

        drawDiagonalFoldLinesOnFolded();

        // Reset state
        dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
        dispatch({ type: ActionType.SET_LINE_START_POINT, payload: null });
        this.originalFoldedCanvasState = null;
        this.originalUnfoldedCanvasState = null;

        return true;
    }

    cancel(context: DrawingModeContext): void {
        const { dispatch, foldedCtx, unfoldedCtx } = context;

        // Restore original states if they exist
        if (this.originalFoldedCanvasState && foldedCtx) {
            foldedCtx.putImageData(this.originalFoldedCanvasState, 0, 0);
        }

        if (this.originalUnfoldedCanvasState && unfoldedCtx) {
            unfoldedCtx.putImageData(this.originalUnfoldedCanvasState, 0, 0);
        }

        // Reset state
        dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
        dispatch({ type: ActionType.SET_LINE_START_POINT, payload: null });
        this.originalFoldedCanvasState = null;
        this.originalUnfoldedCanvasState = null;
    }
} 