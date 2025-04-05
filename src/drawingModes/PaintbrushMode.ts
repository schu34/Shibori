import { DrawingMode, Point, DrawingModeContext } from '../types/DrawingMode';
import { ActionType } from '../store/shiboriCanvasState';
import { getStroke } from 'perfect-freehand';

export class PaintbrushMode implements DrawingMode {
    private originalFoldedCanvasState: ImageData | null = null;

    start(point: Point, context: DrawingModeContext): void {
        const { dispatch, foldedCtx, getFoldedCanvasDimensions } = context;

        // Store canvas states for preview
        if (foldedCtx) {
            const dimensions = getFoldedCanvasDimensions();
            if (dimensions) {
                this.originalFoldedCanvasState = foldedCtx.getImageData(0, 0, dimensions.width, dimensions.height);
            }
        }

        dispatch({ type: ActionType.SET_IS_DRAWING, payload: true });
        dispatch({ type: ActionType.CLEAR_STROKE_POINTS });
        dispatch({ type: ActionType.ADD_STROKE_POINT, payload: point });
    }

    continue(point: Point, context: DrawingModeContext): boolean {
        const { state, dispatch, isInValidDrawingArea, foldedCtx, drawDiagonalFoldLinesOnFolded } = context;

        if (!state.isDrawing) return false;
        if (!isInValidDrawingArea(point.x, point.y)) return false;

        dispatch({ type: ActionType.ADD_STROKE_POINT, payload: point });

        // Draw the stroke
        if (!foldedCtx || state.currentStrokePoints.length === 0) return false;

        // Get the stroke outline points from perfect-freehand
        const stroke = getStroke(state.currentStrokePoints, {
            size: state.lineThickness * 2,
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.5,
        });

        if (!stroke.length) return false;

        // Restore original state before drawing new stroke
        if (this.originalFoldedCanvasState) {
            foldedCtx.putImageData(this.originalFoldedCanvasState, 0, 0);
        }

        // Draw the stroke
        foldedCtx.fillStyle = state.config.lineColor;
        foldedCtx.beginPath();

        // Move to the first point
        const [firstX, firstY] = stroke[0];
        foldedCtx.moveTo(firstX, firstY);

        // Draw the rest of the stroke
        for (let i = 1; i < stroke.length; i++) {
            const [x, y] = stroke[i];
            foldedCtx.lineTo(x, y);
        }

        foldedCtx.closePath();
        foldedCtx.fill();

        drawDiagonalFoldLinesOnFolded();

        return true;
    }

    end(_point: Point, context: DrawingModeContext): void {
        const { dispatch } = context;

        dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
        dispatch({ type: ActionType.CLEAR_STROKE_POINTS });
        this.originalFoldedCanvasState = null;
    }

    cancel(context: DrawingModeContext): void {
        const { dispatch } = context;

        dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
        dispatch({ type: ActionType.CLEAR_STROKE_POINTS });
        this.originalFoldedCanvasState = null;
    }
} 