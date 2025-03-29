import { DrawingMode, Point, DrawingModeContext } from '../types/DrawingMode';
import { ActionType } from '../store/shiboriCanvasState';
import { getStroke } from 'perfect-freehand';

export class PaintbrushMode implements DrawingMode {
    private originalFoldedCanvasState: ImageData | null = null;
    private originalUnfoldedCanvasState: ImageData | null = null;

    start(point: Point, context: DrawingModeContext): void {
        const { dispatch, foldedCanvasRef, unfoldedCanvasRef } = context;

        // Store canvas states for preview
        const foldedCtx = foldedCanvasRef.current?.getContext('2d', { willReadFrequently: true });
        const unfoldedCtx = unfoldedCanvasRef.current?.getContext('2d', { willReadFrequently: true });

        if (foldedCtx && unfoldedCtx && foldedCanvasRef.current && unfoldedCanvasRef.current) {
            this.originalFoldedCanvasState = foldedCtx.getImageData(0, 0, foldedCanvasRef.current.width, foldedCanvasRef.current.height);
            this.originalUnfoldedCanvasState = unfoldedCtx.getImageData(0, 0, unfoldedCanvasRef.current.width, unfoldedCanvasRef.current.height);
        }

        dispatch({ type: ActionType.SET_IS_DRAWING, payload: true });
        dispatch({ type: ActionType.CLEAR_STROKE_POINTS });
        dispatch({ type: ActionType.ADD_STROKE_POINT, payload: point });
    }

    continue(point: Point, context: DrawingModeContext): void {
        const { state, dispatch, isInValidDrawingArea, foldedCanvasRef, drawDiagonalFoldLinesOnFolded, updateUnfoldedCanvas } = context;

        if (!state.isDrawing) return;
        if (!isInValidDrawingArea(point.x, point.y)) return;

        dispatch({ type: ActionType.ADD_STROKE_POINT, payload: point });

        // Draw the stroke
        const foldedCtx = foldedCanvasRef.current?.getContext('2d', { willReadFrequently: true });
        if (!foldedCtx || state.currentStrokePoints.length === 0) return;

        // Get the stroke outline points from perfect-freehand
        const stroke = getStroke(state.currentStrokePoints, {
            size: state.lineThickness * 2,
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.5,
        });

        if (!stroke.length) return;

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
        updateUnfoldedCanvas();
    }

    end(point: Point, context: DrawingModeContext): void {
        const { dispatch } = context;

        dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
        dispatch({ type: ActionType.CLEAR_STROKE_POINTS });
        this.originalFoldedCanvasState = null;
        this.originalUnfoldedCanvasState = null;
    }

    cancel(context: DrawingModeContext): void {
        const { dispatch } = context;


        dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
        dispatch({ type: ActionType.CLEAR_STROKE_POINTS });
        this.originalFoldedCanvasState = null;
        this.originalUnfoldedCanvasState = null;
    }
} 