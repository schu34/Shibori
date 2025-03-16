import React, { useCallback, ChangeEvent } from 'react';
import { State, Action, ActionType } from '../../store/shiboriCanvasState';

interface DimensionControlsProps {
    state: State;
    dispatch: React.Dispatch<Action>;
}

// Define an interface for the dimension changes
interface DimensionChanges {
    width?: number;
    height?: number;
}

export const DimensionControls: React.FC<DimensionControlsProps> = ({ state, dispatch }) => {
    // Handle dimension changes with an object of optional properties
    const handleDimensionChange = useCallback((newDimensions: DimensionChanges) => {
        // Get current values with fallbacks
        const newWidth = Math.max(newDimensions.width || state.canvasDimensions.width, 100);
        const newHeight = Math.max(newDimensions.height || state.canvasDimensions.height, 100);

        // Update the full canvas dimensions
        dispatch({
            type: ActionType.SET_CANVAS_DIMENSIONS,
            payload: {
                width: newWidth,
                height: newHeight
            }
        });
    }, [dispatch, state.canvasDimensions.width, state.canvasDimensions.height]);

    // Event handlers for input change events
    const handleWidthInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        handleDimensionChange({ width: parseInt(e.target.value) });
    }, [handleDimensionChange]);

    const handleHeightInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        handleDimensionChange({ height: parseInt(e.target.value) });
    }, [handleDimensionChange]);

    return (
        <div className="dimension-controls">
            <label htmlFor="canvasWidth">Canvas Width:</label>
            <input
                type="number"
                id="canvasWidth"
                className="dimension-input"
                min="100"
                max="1000"
                value={state.canvasDimensions.width}
                onChange={handleWidthInputChange}
            />
            <label htmlFor="canvasHeight">Height:</label>
            <input
                type="number"
                id="canvasHeight"
                className="dimension-input"
                min="100"
                max="1000"
                value={state.canvasDimensions.height}
                onChange={handleHeightInputChange}
            />
        </div>
    );
}; 