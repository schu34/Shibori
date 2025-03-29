import { DrawingMode, Point, DrawingModeContext } from '../types/DrawingMode';
import { ActionType } from '../store/shiboriCanvasState';

export class LineMode implements DrawingMode {
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

        dispatch({ type: ActionType.SET_LINE_START_POINT, payload: point });
        dispatch({ type: ActionType.SET_IS_DRAWING, payload: true });
    }

    continue(point: Point, context: DrawingModeContext): void {
        const { state, foldedCanvasRef, unfoldedCanvasRef, drawDiagonalFoldLinesOnFolded } = context;

        if (!state.isDrawing || !state.lineStartPoint) return;

        const foldedCanvas = foldedCanvasRef.current;
        const unfoldedCanvas = unfoldedCanvasRef.current;
        if (!foldedCanvas || !unfoldedCanvas) return;

        const foldedCtx = foldedCanvas.getContext('2d', { willReadFrequently: true });
        const unfoldedCtx = unfoldedCanvas.getContext('2d', { willReadFrequently: true });
        if (!foldedCtx || !unfoldedCtx) return;

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

    end(point: Point, context: DrawingModeContext): void {
        const { state, dispatch, foldedCanvasRef, isInValidDrawingArea, drawDiagonalFoldLinesOnFolded, updateUnfoldedCanvas } = context;

        if (!state.isDrawing || !state.lineStartPoint) return;

        const startValid = isInValidDrawingArea(state.lineStartPoint.x, state.lineStartPoint.y);
        const endValid = isInValidDrawingArea(point.x, point.y);

        if (!startValid && !endValid) {
            this.cancel(context);
            return;
        }

        const foldedCtx = foldedCanvasRef.current?.getContext('2d', { willReadFrequently: true });
        if (!foldedCtx) {
            this.cancel(context);
            return;
        }

        // Draw final line
        foldedCtx.beginPath();
        foldedCtx.moveTo(state.lineStartPoint.x, state.lineStartPoint.y);
        foldedCtx.lineTo(point.x, point.y);
        foldedCtx.strokeStyle = state.config.lineColor;
        foldedCtx.lineWidth = state.lineThickness;
        foldedCtx.stroke();

        drawDiagonalFoldLinesOnFolded();
        updateUnfoldedCanvas();

        // Reset state
        dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
        dispatch({ type: ActionType.SET_LINE_START_POINT, payload: null });
        this.originalFoldedCanvasState = null;
        this.originalUnfoldedCanvasState = null;
    }

    cancel(context: DrawingModeContext): void {
        const { dispatch, foldedCanvasRef, unfoldedCanvasRef } = context;

        // Restore original states if they exist
        if (this.originalFoldedCanvasState && foldedCanvasRef.current) {
            const foldedCtx = foldedCanvasRef.current.getContext('2d', { willReadFrequently: true });
            if (foldedCtx) {
                foldedCtx.putImageData(this.originalFoldedCanvasState, 0, 0);
            }
        }

        if (this.originalUnfoldedCanvasState && unfoldedCanvasRef.current) {
            const unfoldedCtx = unfoldedCanvasRef.current.getContext('2d', { willReadFrequently: true });
            if (unfoldedCtx) {
                unfoldedCtx.putImageData(this.originalUnfoldedCanvasState, 0, 0);
            }
        }

        // Reset state
        dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
        dispatch({ type: ActionType.SET_LINE_START_POINT, payload: null });
        this.originalFoldedCanvasState = null;
        this.originalUnfoldedCanvasState = null;
    }
} 