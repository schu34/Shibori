import { DrawingTool } from '../types';
import { DrawableDrawingTool, DrawingMode, DrawingModeGeometry } from '../types/DrawingMode';
import { CircleGeometry, CircleMode } from './CircleMode';
import { LineGeometry, LineMode } from './LineMode';
import { PaintbrushGeometry, PaintbrushMode } from './PaintbrushMode';
import { RectangleGeometry, RectangleMode } from './RectangleMode';
import { SquareGeometry, SquareMode } from './SquareMode';
import { BezierGeometry, BezierMode } from './BezierMode';

export class DrawingModeFactory {
    private static instances: Map<DrawableDrawingTool, DrawingMode> = new Map();
    private static geometry: Record<DrawableDrawingTool, DrawingModeGeometry> = {
        [DrawingTool.Line]: LineGeometry,
        [DrawingTool.Paintbrush]: PaintbrushGeometry,
        [DrawingTool.Rectangle]: RectangleGeometry,
        [DrawingTool.Square]: SquareGeometry,
        [DrawingTool.Circle]: CircleGeometry,
        [DrawingTool.Bezier]: BezierGeometry,
    };
    static getTool(tool: DrawableDrawingTool): DrawingMode {
        let instance = this.instances.get(tool);

        if (!instance) {
            instance = this.createToolInstance(tool);
            this.instances.set(tool, instance);
        }

        return instance;
    }

    static getGeometry(tool: DrawableDrawingTool): DrawingModeGeometry {
        return this.geometry[tool];
    }

    /**
     * Create a new instance of the specified tool
     */
    private static createToolInstance(tool: DrawableDrawingTool): DrawingMode {
        switch (tool) {
            case DrawingTool.Line:
                return new LineMode();
                
            case DrawingTool.Paintbrush:
                return new PaintbrushMode();

            case DrawingTool.Rectangle:
                return new RectangleMode();

            case DrawingTool.Square:
                return new SquareMode();

            case DrawingTool.Circle:
                return new CircleMode();

            case DrawingTool.Bezier:
                return new BezierMode();

            default:
                // asserts that this switch is exhaustive
                assertNever(tool);
        }
    }

    static clearInstances(): void {
        this.instances.clear();
    }
}

function assertNever(tool: never): never {
    throw new Error(`Unknown drawing tool: ${tool}`);
}
