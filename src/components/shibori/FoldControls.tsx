import React, { useCallback } from 'react';
import { ActionType } from '../../store/shiboriCanvasState';
import { useAppSelector, useAppDispatch } from '../../hooks/useReduxHooks';

export const FoldControls: React.FC = () => {
    const dispatch = useAppDispatch();
    const state = useAppSelector((state) => state.shibori);

    // Handle fold button clicks (increase fold count)
    const handleFoldButtonClick = useCallback((isVertical: boolean) => {
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
    }, [dispatch, state.folds.vertical, state.folds.horizontal, state.config.maxFolds]);

    // Handle unfold button clicks (decrease fold count)
    const handleUnfoldButtonClick = useCallback((isVertical: boolean) => {
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
    }, [dispatch, state.folds.vertical, state.folds.horizontal]);

    // Handle reset button click
    const handleResetButtonClick = useCallback(() => {
        dispatch({ type: ActionType.RESET_FOLDS });
    }, [dispatch]);


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
        <div className="fold-controls-layout">
            <div className="fold-controls-group">
                <h3>Folds</h3>
                <div className="fold-control-row">
                    <span className="fold-row-label">Vertical Folds: {state.folds.vertical}</span>
                    <div className="fold-buttons">
                        <button
                            className="fold-step-button"
                            onClick={() => handleUnfoldButtonClick(true)}
                            disabled={state.folds.vertical <= 0}
                            title="Decrease vertical folds">
                            <span aria-hidden="true">-</span>
                            <span className="visually-hidden">Unfold -</span>
                        </button>
                        <button
                            className="fold-step-button"
                            onClick={() => handleFoldButtonClick(true)}
                            disabled={state.folds.vertical >= state.config.maxFolds}
                            title="Increase vertical folds">
                            <span aria-hidden="true">+</span>
                            <span className="visually-hidden">Fold +</span>
                        </button>
                    </div>
                </div>

                <div className="fold-control-row">
                    <span className="fold-row-label">Horizontal Folds: {state.folds.horizontal}</span>
                    <div className="fold-buttons">
                        <button
                            className="fold-step-button"
                            onClick={() => handleUnfoldButtonClick(false)}
                            disabled={state.folds.horizontal <= 0}
                            title="Decrease horizontal folds">
                            <span aria-hidden="true">-</span>
                            <span className="visually-hidden">Unfold -</span>
                        </button>
                        <button
                            className="fold-step-button"
                            onClick={() => handleFoldButtonClick(false)}
                            disabled={state.folds.horizontal >= state.config.maxFolds}
                            title="Increase horizontal folds">
                            <span aria-hidden="true">+</span>
                            <span className="visually-hidden">Fold +</span>
                        </button>
                    </div>
                </div>

                <div className="fold-control-row">
                    <span className="fold-row-label">Diagonal Folds: {state.folds.diagonal.count}</span>
                    <div className="fold-buttons">
                        <button
                            className="fold-step-button"
                            onClick={handleDiagonalFoldDecrease}
                            disabled={state.folds.diagonal.count <= 0}
                            title="Decrease diagonal folds">
                            <span aria-hidden="true">-</span>
                            <span className="visually-hidden">Unfold -</span>
                        </button>
                        <button
                            className="fold-step-button"
                            onClick={handleDiagonalFoldIncrease}
                            disabled={state.folds.diagonal.count >= 1 || !isDiagonalFoldAllowed()}
                            title="Increase diagonal folds">
                            <span aria-hidden="true">+</span>
                            <span className="visually-hidden">Fold +</span>
                        </button>
                    </div>
                </div>

                <button className="reset-folds-button" onClick={handleResetButtonClick}>
                    Reset Folds
                </button>
            </div>
        </div>
    );
}; 
