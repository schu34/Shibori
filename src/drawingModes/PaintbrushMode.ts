import { DrawingMode, Point, DrawingModeContext, UndoableHistoryItem } from '../types/DrawingMode';
import { ActionType } from '../store/shiboriCanvasState';
import { getStroke } from 'perfect-freehand';
import { DrawingTool } from '../types';

export class PaintbrushMode implements DrawingMode {
    private originalFoldedCanvasState: ImageData | null = null;

    start(point: Point, context: DrawingModeContext): void {
        console.log('PaintbrushMode.start called with point:', point);
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
        const { getState, dispatch, isInValidDrawingArea, foldedCtx, drawDiagonalFoldLinesOnFolded } = context;

        const { isDrawing, lineThickness, config } = getState();
        if (!isDrawing) return false;
        if (!isInValidDrawingArea(point.x, point.y)) return false;

        dispatch({ type: ActionType.ADD_STROKE_POINT, payload: point });

        //call getState() again to get the latest state so we read currentStrokePoints _AFTER_ the dispatch
        const { currentStrokePoints } = getState();

        // Draw the stroke
        if (!foldedCtx || currentStrokePoints.length === 0) return false;

        // Get the stroke outline points from perfect-freehand
        const stroke = getStroke(currentStrokePoints, {
            size: lineThickness * 2,
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
        foldedCtx.fillStyle = config.lineColor;
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

    end(_point: Point | null, context: DrawingModeContext): UndoableHistoryItem | null {
        const { dispatch, getState } = context;

        const { currentStrokePoints } = getState();

        dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
        dispatch({ type: ActionType.CLEAR_STROKE_POINTS });
        this.originalFoldedCanvasState = null;
        return {
            action: DrawingTool.Paintbrush,
            points: currentStrokePoints,
        };
    }

    cancel(context: DrawingModeContext): void {
        const { dispatch } = context;

        dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
        dispatch({ type: ActionType.CLEAR_STROKE_POINTS });
        this.originalFoldedCanvasState = null;
    }
} 
