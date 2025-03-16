import React, { useCallback } from 'react';
import { State, Action, ActionType } from '../../store/shiboriCanvasState';

interface FoldControlsProps {
    state: State;
    dispatch: React.Dispatch<Action>;
}

export const FoldControls: React.FC<FoldControlsProps> = ({ state, dispatch }) => {
    // Handle fold button clicks (increase fold count)
    const handleFoldButtonClick = (isVertical: boolean) => {
        const foldCount = isVertical ? state.folds.vertical : state.folds.horizontal;

        if (foldCount < state.config.maxFolds) {
            dispatch({
                type: ActionType.UPDATE_FOLD,
                payload: {
                    axis: isVertical ? 'vertical' : 'horizontal',
                    value: foldCount + 1
                }
            });
        }
    };

    // Handle unfold button clicks (decrease fold count)
    const handleUnfoldButtonClick = (isVertical: boolean) => {
        const foldCount = isVertical ? state.folds.vertical : state.folds.horizontal;

        if (foldCount > 0) {
            dispatch({
                type: ActionType.UPDATE_FOLD,
                payload: {
                    axis: isVertical ? 'vertical' : 'horizontal',
                    value: foldCount - 1
                }
            });
        }
    };

    // Handle reset button click
    const handleResetButtonClick = () => {
        dispatch({ type: ActionType.RESET_FOLDS });
    };


    // Handle diagonal fold count change (increase)
    const handleDiagonalFoldIncrease = useCallback(() => {
        const currentCount = state.folds.diagonal.count;

        if (currentCount < state.config.maxFolds) {
            dispatch({
                type: ActionType.UPDATE_DIAGONAL_FOLD_COUNT,
                payload: currentCount + 1
            });
        }
    }, [dispatch, state.folds.diagonal.count, state.config.maxFolds]);

    // Handle diagonal fold count decrease (unfold)
    const handleDiagonalFoldDecrease = useCallback(() => {
        const currentCount = state.folds.diagonal.count;
        if (currentCount > 0) {
            dispatch({
                type: ActionType.UPDATE_DIAGONAL_FOLD_COUNT,
                payload: currentCount - 1
            });
        }
    }, [dispatch, state.folds.diagonal.count]);


    // Check if diagonal folds are allowed (square canvas)
    const isDiagonalFoldAllowed = useCallback(() => {
        return state.folds.vertical === state.folds.horizontal;
    }, [state.folds.vertical, state.folds.horizontal]);

    return (
        <div className="button-container">
            <div className="fold-controls-group">
                <h3>Vertical Folds: {state.folds.vertical}</h3>
                <div className="fold-buttons">
                    <button
                        onClick={() => handleFoldButtonClick(true)}
                        disabled={state.folds.vertical >= state.config.maxFolds}>
                        Fold +
                    </button>
                    <button
                        onClick={() => handleUnfoldButtonClick(true)}
                        disabled={state.folds.vertical <= 0}>
                        Unfold -
                    </button>
                </div>
            </div>

            <div className="fold-controls-group">
                <h3>Horizontal Folds: {state.folds.horizontal}</h3>
                <div className="fold-buttons">
                    <button
                        onClick={() => handleFoldButtonClick(false)}
                        disabled={state.folds.horizontal >= state.config.maxFolds}>
                        Fold +
                    </button>
                    <button
                        onClick={() => handleUnfoldButtonClick(false)}
                        disabled={state.folds.horizontal <= 0}>
                        Unfold -
                    </button>
                </div>
            </div>

            <div className="diagonal-fold-controls">
                <span>Diagonal Fold</span>
                <>
                    <h3>Diagonal Folds: {state.folds.diagonal.count}</h3>
                    <button
                        onClick={handleDiagonalFoldIncrease}
                        disabled={state.folds.diagonal.count >= 1 || !isDiagonalFoldAllowed()}>
                        +
                    </button>
                    <button
                        onClick={handleDiagonalFoldDecrease}
                        disabled={state.folds.diagonal.count <= 0}>
                        -
                    </button>
                </>

            </div>

            <button onClick={handleResetButtonClick}>
                Reset Folds
            </button>
        </div>
    );
}; 