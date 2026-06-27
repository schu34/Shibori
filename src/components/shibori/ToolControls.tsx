import React from 'react';
import { ToolSelector } from './ToolSelector';
import { SizeControl } from './SizeControl';
import { WebGLControls } from './WebGLControls';
import { useAppSelector } from '../../hooks/useReduxHooks';

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
            <WebGLControls />
        </div>
    );
}; 
