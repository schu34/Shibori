import { DrawingTool } from '../types';
import { DrawingMode } from '../types/DrawingMode';
import { LineMode } from './LineMode';
import { PaintbrushMode } from './PaintbrushMode';

export class DrawingModeFactory {
    private static instances: Map<DrawingTool, DrawingMode> = new Map();

    static getTool(tool: DrawingTool): DrawingMode {
        let instance = this.instances.get(tool);

        if (!instance) {
            switch (tool) {
                case DrawingTool.Line:
                    instance = new LineMode();
                    break;
                case DrawingTool.Paintbrush:
                    instance = new PaintbrushMode();
                    break;
                default:
                    // asserts that this is switch is exhaustive
                    assertNever(tool);
            }
            this.instances.set(tool, instance);
        }

        return instance;
    }
}

function assertNever(tool: never): never {
    throw new Error(`Unknown drawing tool: ${tool}`);
}
