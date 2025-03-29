import React, { useCallback } from 'react';
import { DrawingTool } from '../../types';
import { Action, ActionType } from '../../store/shiboriCanvasState';

interface SizeControlProps {
    tool: DrawingTool;
    value: number;
    dispatch: React.Dispatch<Action>;
}

export const SizeControl: React.FC<SizeControlProps> = ({ tool, value, dispatch }) => {
    const handleSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseInt(e.target.value);
        if (tool === DrawingTool.Circle) {
            dispatch({ type: ActionType.SET_CIRCLE_RADIUS, payload: newValue });
        } else {
            dispatch({ type: ActionType.SET_LINE_THICKNESS, payload: newValue });
        }
    }, [dispatch, tool]);

    const getControlConfig = () => {
        switch (tool) {
            case DrawingTool.Circle:
                return {
                    label: 'Circle Size:',
                    min: 5,
                    max: 50,
                    id: 'sizeSlider'
                };
            case DrawingTool.Line:
                return {
                    label: 'Line Thickness:',
                    min: 1,
                    max: 20,
                    id: 'lineThicknessSlider'
                };
            case DrawingTool.Paintbrush:
                return {
                    label: 'Brush Thickness:',
                    min: 1,
                    max: 20,
                    id: 'brushThicknessSlider'
                };
        }
    };

    const config = getControlConfig();

    return (
        <div className="tool-controls-group">
            <h3>
                <label htmlFor={config.id}>{config.label}</label>
            </h3>
            <div className="slider-container">
                <input
                    type="range"
                    id={config.id}
                    min={config.min}
                    max={config.max}
                    value={value}
                    onChange={handleSizeChange}
                />
                <span>{value}</span>px
            </div>
        </div>
    );
}; 