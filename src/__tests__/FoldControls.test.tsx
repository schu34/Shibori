import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FoldControls } from '../components/shibori/FoldControls';
import { State } from '../store/shiboriCanvasState';
import { DrawingTool, DiagonalDirection } from '../types';

describe('FoldControls Component', () => {
    const mockState: State = {
        config: {
            maxFolds: 3,
            // Include other required state properties to avoid TypeScript errors
            unfoldedCanvasWidth: 400,
            unfoldedCanvasHeight: 400,
            defaultCircleRadius: 20,
            circleColor: 'white',
            defaultLineThickness: 2,
            lineColor: 'white',
        },
        folds: {
            vertical: 2,
            horizontal: 1,
            diagonal: {
                enabled: false,
                count: 0,
                direction: DiagonalDirection.TopLeftToBottomRight
            }
        },
        // Other required state properties
        circleRadius: 20,
        lineThickness: 2,
        currentTool: DrawingTool.Circle,
        isDrawing: false,
        lineStartPoint: null,
        canvasDimensions: {
            width: 400,
            height: 400
        }
    };

    const mockDispatch = jest.fn();

    beforeEach(() => {
        mockDispatch.mockClear();
    });

    test('renders fold buttons', () => {
        render(<FoldControls state={mockState} dispatch={mockDispatch} />);

        expect(screen.getByText('Fold Vertically')).toBeInTheDocument();
        expect(screen.getByText('Fold Horizontally')).toBeInTheDocument();
        expect(screen.getByText('Reset Folds')).toBeInTheDocument();
    });

    test('vertical fold button dispatches correct action', () => {
        render(<FoldControls state={mockState} dispatch={mockDispatch} />);

        fireEvent.click(screen.getByText('Fold Vertically'));

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'UPDATE_FOLD',
            payload: {
                axis: 'vertical',
                value: 3
            }
        });
    });

    test('reset button dispatches correct action', () => {
        render(<FoldControls state={mockState} dispatch={mockDispatch} />);

        fireEvent.click(screen.getByText('Reset Folds'));

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'RESET_FOLDS'
        });
    });

    test('disables fold button when max folds is reached', () => {
        const stateWithMaxFolds: State = {
            ...mockState,
            folds: {
                ...mockState.folds,
                vertical: 3 // Max folds
            }
        };

        render(<FoldControls state={stateWithMaxFolds} dispatch={mockDispatch} />);

        const verticalFoldButton = screen.getByText('Fold Vertically');
        expect(verticalFoldButton).toBeDisabled();
    });
}); 