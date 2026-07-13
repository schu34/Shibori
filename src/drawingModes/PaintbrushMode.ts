import { DrawingMode, Point, DrawingModeContext, UndoableHistoryItem } from '../types/DrawingMode';
import { getStroke } from 'perfect-freehand';
import { DrawingTool } from '../types';
import { CanvasService } from '../services/CanvasService';
import { DrawingModeGeometry } from '../types/DrawingMode';
import { distanceToPolyline, expandBounds, getBoundsFromPoints, translatePoint, translatePoints } from '../utils/geometryMath';

export const PaintbrushGeometry: DrawingModeGeometry = {
    hitTest(item, point, options) {
        const tolerance = Math.max(options.hitTolerance ?? 8, options.lineThickness);
        return distanceToPolyline(point, item.points) <= tolerance;
    },
    getBounds(item, options) {
        const bounds = getBoundsFromPoints(item.points);
        return bounds ? expandBounds(bounds, options.lineThickness) : null;
    },
    translate(item, delta) {
        return {
            ...item,
            points: translatePoints(item.points, delta),
            rotationCenter: item.rotationCenter
                ? translatePoint(item.rotationCenter, delta)
                : undefined,
        };
    },
};

export class PaintbrushMode implements DrawingMode {
    private originalFoldedCanvasState: ImageData | null = null;
    private points: Point[] = [];
    private active = false;

    start(point: Point, context: DrawingModeContext): void {
        const { foldedCtx, getFoldedCanvasDimensions } = context;

        // Store canvas states for preview
        if (foldedCtx) {
            const dimensions = getFoldedCanvasDimensions();
            if (dimensions) {
                this.originalFoldedCanvasState = foldedCtx.getImageData(0, 0, dimensions.width, dimensions.height);
            }
        }

        this.active = true;
        this.points = [point];
    }

    continue(point: Point, context: DrawingModeContext): boolean {
        const { getState, foldedCtx, foldedCanvas } = context;

        const { folds, lineThickness, config } = getState();
        if (!this.active) return false;
        this.points.push(point);

        // Draw the stroke
        if (!foldedCtx || this.points.length === 0) return false;

        // Get the stroke outline points from perfect-freehand
        const stroke = getStroke(this.points, {
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
        foldedCtx.save();
        if (foldedCanvas) {
            CanvasService.clipToDrawableRegion(foldedCtx, foldedCanvas, folds);
        }
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
        foldedCtx.restore();

        return true;
    }

    end(_point: Point | null, context: DrawingModeContext): UndoableHistoryItem | null {
        const { getState } = context;
        if (!this.active) return null;
        const { lineThickness, config } = getState();
        const points = this.points;
        this.active = false;
        this.points = [];
        this.originalFoldedCanvasState = null;
        return {
            action: DrawingTool.Paintbrush,
            points,
            style: {
                lineThickness,
                color: config.lineColor,
            },
        };
    }

    cancel(context: DrawingModeContext): void {
        if (this.originalFoldedCanvasState) {
            context.foldedCtx.putImageData(this.originalFoldedCanvasState, 0, 0);
        }
        this.active = false;
        this.points = [];
        this.originalFoldedCanvasState = null;
    }
} 
