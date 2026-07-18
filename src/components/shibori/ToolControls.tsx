import React from 'react';
import { SizeControl } from './SizeControl';
import { ShapeFillControl } from './ShapeFillControl';
import { useAppSelector } from '../../hooks/useReduxHooks';
import { DrawingTool } from '../../types';

const shapeTools = new Set<DrawingTool>([
    DrawingTool.Rectangle,
    DrawingTool.Square,
    DrawingTool.Circle,
    DrawingTool.Bezier,
]);
const toolsWithSizeControl = new Set<DrawingTool>([
    DrawingTool.Line,
    DrawingTool.Paintbrush,
    DrawingTool.Rectangle,
    DrawingTool.Square,
    DrawingTool.Circle,
    DrawingTool.Bezier,
]);

export const ToolControls: React.FC = () => {
    const state = useAppSelector((state) => state.shibori);

    return (
        <div className="tool-controls-layout">
            {toolsWithSizeControl.has(state.currentTool) && (
                <SizeControl
                    tool={state.currentTool}
                    value={state.lineThickness}
                />
            )}
            {shapeTools.has(state.currentTool) && (
                <ShapeFillControl fillMode={state.shapeFillMode} />
            )}
            {!toolsWithSizeControl.has(state.currentTool) && (
                <p className="tool-options-empty">This tool has no additional options.</p>
            )}
        </div>
    );
};
