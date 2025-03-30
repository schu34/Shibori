import React from 'react';
import { ToolSelector } from './ToolSelector';
import { SizeControl } from './SizeControl';
import { DrawingTool } from '../../types';
import { useAppSelector } from '../../hooks/useReduxHooks';

export const ToolControls: React.FC = () => {
    const state = useAppSelector((state) => state.shibori);

    return (
        <div className="button-container">
            <ToolSelector
                currentTool={state.currentTool}
            />
            <SizeControl
                tool={state.currentTool}
                value={state.currentTool === DrawingTool.Circle ? state.circleRadius : state.lineThickness}
            />
        </div>
    );
}; 