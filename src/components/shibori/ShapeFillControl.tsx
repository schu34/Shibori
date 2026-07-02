import React, { useCallback } from 'react';
import { ShapeFillMode } from '../../types';
import { ActionType } from '../../store/shiboriCanvasState';
import { useAppDispatch } from '../../hooks/useReduxHooks';

interface ShapeFillControlProps {
    fillMode: ShapeFillMode;
}

export const ShapeFillControl: React.FC<ShapeFillControlProps> = ({ fillMode }) => {
    const dispatch = useAppDispatch();

    const handleFillModeChange = useCallback((mode: ShapeFillMode) => {
        dispatch({ type: ActionType.SET_SHAPE_FILL_MODE, payload: mode });
    }, [dispatch]);

    return (
        <div className="tool-controls-group">
            <h3>Shape Fill:</h3>
            <div className="radio-group">
                <label>
                    <input
                        type="radio"
                        name="shapeFillMode"
                        value={ShapeFillMode.Filled}
                        checked={fillMode === ShapeFillMode.Filled}
                        onChange={() => handleFillModeChange(ShapeFillMode.Filled)}
                    />
                    Filled
                </label>
                <label>
                    <input
                        type="radio"
                        name="shapeFillMode"
                        value={ShapeFillMode.Outline}
                        checked={fillMode === ShapeFillMode.Outline}
                        onChange={() => handleFillModeChange(ShapeFillMode.Outline)}
                    />
                    Outline
                </label>
            </div>
        </div>
    );
};
