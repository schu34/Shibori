import React, { useCallback } from 'react';
import { State, Action } from '../../store/shiboriCanvasState';
import { DiagonalDirection } from '../../types';

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
                type: 'UPDATE_FOLD',
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
                type: 'UPDATE_FOLD',
                payload: {
                    axis: isVertical ? 'vertical' : 'horizontal',
                    value: foldCount - 1
                }
            });
        }
    };

    // Handle reset button click
    const handleResetButtonClick = () => {
        dispatch({ type: 'RESET_FOLDS' });
    };

    // Handle diagonal fold toggle
    const handleDiagonalFoldToggle = useCallback(() => {
        dispatch({
            type: 'TOGGLE_DIAGONAL_FOLD',
            payload: !state.folds.diagonal.enabled
        });
    }, [dispatch, state.folds.diagonal.enabled]);

    // Handle diagonal fold count change (increase)
    const handleDiagonalFoldIncrease = useCallback(() => {
        const currentCount = state.folds.diagonal.count;

        if (currentCount < state.config.maxFolds) {
            dispatch({
                type: 'UPDATE_DIAGONAL_FOLD_COUNT',
                payload: currentCount + 1
            });
        }
    }, [dispatch, state.folds.diagonal.count, state.config.maxFolds]);

    // Handle diagonal fold count decrease (unfold)
    const handleDiagonalFoldDecrease = useCallback(() => {
        const currentCount = state.folds.diagonal.count;
        if (currentCount > 0) {
            dispatch({
                type: 'UPDATE_DIAGONAL_FOLD_COUNT',
                payload: currentCount - 1
            });
        }
    }, [dispatch, state.folds.diagonal.count]);

    // Handle diagonal direction change
    const handleDiagonalDirectionChange = useCallback(() => {
        const newDirection = state.folds.diagonal.direction === DiagonalDirection.TopLeftToBottomRight
            ? DiagonalDirection.TopRightToBottomLeft
            : DiagonalDirection.TopLeftToBottomRight;

        dispatch({
            type: 'UPDATE_DIAGONAL_FOLD_DIRECTION',
            payload: newDirection
        });
    }, [dispatch, state.folds.diagonal.direction]);

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
                <label className="toggle-switch">
                    <input
                        type="checkbox"
                        checked={state.folds.diagonal.enabled}
                        onChange={handleDiagonalFoldToggle}
                        disabled={!isDiagonalFoldAllowed()}
                    />
                    <span className="slider round"></span>
                </label>
                <span>Diagonal Fold</span>

                {state.folds.diagonal.enabled && (
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
                        <button
                            onClick={handleDiagonalDirectionChange}
                            disabled={!isDiagonalFoldAllowed()}>
                            Direction: {state.folds.diagonal.direction === DiagonalDirection.TopLeftToBottomRight
                                ? '↘️ Top-Left to Bottom-Right'
                                : '↙️ Top-Right to Bottom-Left'}
                        </button>
                    </>
                )}
            </div>

            <button onClick={handleResetButtonClick}>
                Reset Folds
            </button>
        </div>
    );
}; 