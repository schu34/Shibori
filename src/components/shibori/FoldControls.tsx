import React from 'react';
import { State, Action } from '../../store/shiboriCanvasState';

interface FoldControlsProps {
    state: State;
    dispatch: React.Dispatch<Action>;
}

export const FoldControls: React.FC<FoldControlsProps> = ({ state, dispatch }) => {
    // Handle fold button clicks
    const handleFoldButtonClick = (isVertical: boolean) => {
        const foldCount = isVertical ? state.folds.vertical : state.folds.horizontal;

        if (foldCount < state.config.maxFolds) {
            dispatch({
                type: 'UPDATE_FOLD',
                payload: {
                    axis: isVertical ? 'vertical' : 'horizontal',
                    value: foldCount + 1
                }
            });
        }
    };

    // Handle reset button click
    const handleResetButtonClick = () => {
        dispatch({ type: 'RESET_FOLDS' });
    };

    return (
        <div className="button-container">
            <button
                onClick={() => handleFoldButtonClick(true)}
                disabled={state.folds.vertical >= state.config.maxFolds}>
                Fold Vertically
            </button>
            <button
                onClick={() => handleFoldButtonClick(false)}
                disabled={state.folds.horizontal >= state.config.maxFolds}>
                Fold Horizontally
            </button>
            <button onClick={handleResetButtonClick}>
                Reset Folds
            </button>
        </div>
    );
}; 