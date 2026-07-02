import React from 'react';
import { ToolSelector } from './ToolSelector';
import { SizeControl } from './SizeControl';
import { ShapeFillControl } from './ShapeFillControl';
import { WebGLControls } from './WebGLControls';
import { useAppSelector } from '../../hooks/useReduxHooks';
import { DrawingTool } from '../../types';

const shapeTools = new Set<DrawingTool>([
    DrawingTool.Rectangle,
    DrawingTool.Square,
    DrawingTool.Circle,
]);

export const ToolControls: React.FC = () => {
    const state = useAppSelector((state) => state.shibori);

    return (
        <div className="tool-controls-layout">
            <ToolSelector
                currentTool={state.currentTool}
            />
            <SizeControl
                tool={state.currentTool}
                value={state.lineThickness}
            />
            {shapeTools.has(state.currentTool) && (
                <ShapeFillControl fillMode={state.shapeFillMode} />
            )}
            <WebGLControls />
        </div>
    );
}; 
