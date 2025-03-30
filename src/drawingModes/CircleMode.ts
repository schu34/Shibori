import { DrawingMode, Point, DrawingModeContext } from '../types/DrawingMode';
import { ActionType } from '../store/shiboriCanvasState';

export class CircleMode implements DrawingMode {
    start(point: Point, context: DrawingModeContext): void {
        const { dispatch, foldedCtx, isInValidDrawingArea, drawDiagonalFoldLinesOnFolded, updateUnfoldedCanvas, state } = context;

        dispatch({ type: ActionType.SET_IS_DRAWING, payload: true });

        if (!isInValidDrawingArea(point.x, point.y)) return;


        foldedCtx.beginPath();
        foldedCtx.arc(point.x, point.y, state.circleRadius, 0, Math.PI * 2);
        foldedCtx.fillStyle = state.config.circleColor;
        foldedCtx.fill();

        drawDiagonalFoldLinesOnFolded();
        updateUnfoldedCanvas();
    }

    continue(point: Point, context: DrawingModeContext): void {
        if (!context.state.isDrawing) return;
        this.start(point, context);
    }

    end(_point: Point, context: DrawingModeContext): void {
        context.dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
    }

    cancel(context: DrawingModeContext): void {
        context.dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
    }
} 