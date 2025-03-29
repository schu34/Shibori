import { DrawingTool } from '../types';
import { DrawingMode } from '../types/DrawingMode';
import { CircleMode } from './CircleMode';
import { LineMode } from './LineMode';
import { PaintbrushMode } from './PaintbrushMode';

export class DrawingModeFactory {
    private static instances: Map<DrawingTool, DrawingMode> = new Map();

    static getMode(tool: DrawingTool): DrawingMode {
        let instance = this.instances.get(tool);

        if (!instance) {
            switch (tool) {
                case DrawingTool.Circle:
                    instance = new CircleMode();
                    break;
                case DrawingTool.Line:
                    instance = new LineMode();
                    break;
                case DrawingTool.Paintbrush:
                    instance = new PaintbrushMode();
                    break;
                default:
                    throw new Error(`Unknown drawing tool: ${tool}`);
            }
            this.instances.set(tool, instance);
        }

        return instance;
    }
} 