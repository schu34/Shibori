import { DrawingTool } from '../types';
import { DrawableDrawingTool, DrawingMode, DrawingModeGeometry } from '../types/DrawingMode';
import { CircleGeometry, CircleMode } from './CircleMode';
import { LineGeometry, LineMode } from './LineMode';
import { PaintbrushGeometry, PaintbrushMode } from './PaintbrushMode';
import { RectangleGeometry, RectangleMode } from './RectangleMode';
import { SquareGeometry, SquareMode } from './SquareMode';

export type RenderingMode = 'canvas2d' | 'webgl' | 'auto';

export interface DrawingModeConfig {
    /** Preferred rendering mode */
    renderingMode?: RenderingMode;
    /** Whether to enable WebGL acceleration when available */
    useWebGL?: boolean;
}

interface DrawingModeDebugInfo {
    tool: DrawingTool;
    type: string;
}

export class DrawingModeFactory {
    private static instances: Map<string, DrawingMode> = new Map();
    private static geometry: Record<DrawableDrawingTool, DrawingModeGeometry> = {
        [DrawingTool.Line]: LineGeometry,
        [DrawingTool.Paintbrush]: PaintbrushGeometry,
        [DrawingTool.Rectangle]: RectangleGeometry,
        [DrawingTool.Square]: SquareGeometry,
        [DrawingTool.Circle]: CircleGeometry,
    };
    private static config: DrawingModeConfig = {
        renderingMode: 'auto',
        useWebGL: true
    };

    /**
     * Configure the factory settings
     */
    static configure(config: Partial<DrawingModeConfig>): void {
        this.config = { ...this.config, ...config };
        // Clear instances to force recreation with new config
        this.clearInstances();
    }

    /**
     * Get drawing tool instance with current configuration
     */
    static getTool(tool: DrawableDrawingTool): DrawingMode {
        const key = this.getInstanceKey(tool);
        let instance = this.instances.get(key);

        if (!instance) {
            instance = this.createToolInstance(tool);
            this.instances.set(key, instance);
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

            default:
                // asserts that this switch is exhaustive
                assertNever(tool);
        }
    }

    /**
     * Generate instance key based on tool and configuration
     */
    private static getInstanceKey(tool: DrawableDrawingTool): string {
        return tool;
    }

    /**
     * Clear all cached instances (useful when configuration changes)
     */
    static clearInstances(): void {
        this.instances.clear();
    }

    /**
     * Get current configuration
     */
    static getConfig(): DrawingModeConfig {
        return { ...this.config };
    }

    /**
     * Check if WebGL is being used for a specific tool
     */
    static isUsingWebGL(): boolean {
        return false;
    }

    /**
     * Get debug information about current instances
     */
    static getDebugInfo(): {
        instances: DrawingModeDebugInfo[];
        config: DrawingModeConfig;
    } {
        const instances: DrawingModeDebugInfo[] = [];
        
        for (const [key, instance] of this.instances) {
            const tool = key.split('_')[0] as DrawingTool;
            const info: DrawingModeDebugInfo = {
                tool,
                type: instance.constructor.name
            };

            instances.push(info);
        }

        return {
            instances,
            config: this.config
        };
    }
}

function assertNever(tool: never): never {
    throw new Error(`Unknown drawing tool: ${tool}`);
}
