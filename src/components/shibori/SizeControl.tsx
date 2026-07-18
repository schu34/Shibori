import React, { useCallback } from 'react';
import { DrawingTool } from '../../types';
import { ActionType } from '../../store/shiboriCanvasState';
import { useAppDispatch } from '../../hooks/useReduxHooks';

interface SizeControlProps {
    tool: DrawingTool;
    value: number;
}

export const SizeControl: React.FC<SizeControlProps> = ({ tool, value }) => {
    const dispatch = useAppDispatch();

    const handleSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseInt(e.target.value);
        dispatch({ type: ActionType.SET_LINE_THICKNESS, payload: newValue });
    }, [dispatch]);

    const getControlConfig = () => {
        switch (tool) {
            case DrawingTool.Line:
            case DrawingTool.Bezier:
                return {
                    label: 'Line Thickness:',
                    min: 1,
                    max: 40,
                    id: 'lineThicknessSlider'
                };
            case DrawingTool.Paintbrush:
                return {
                    label: 'Brush Thickness:',
                    min: 1,
                    max: 40,
                    id: 'brushThicknessSlider'
                };
            case DrawingTool.Rectangle:
            case DrawingTool.Square:
            case DrawingTool.Circle:
                return {
                    label: 'Outline Thickness:',
                    min: 1,
                    max: 40,
                    id: 'shapeThicknessSlider'
                };
            default:
                return null;
        }
    };

    const config = getControlConfig();
    if (!config) return null;

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
