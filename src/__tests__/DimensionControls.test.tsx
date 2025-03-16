import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DimensionControls } from '../components/shibori/DimensionControls';
import { State } from '../store/shiboriCanvasState';
import { DrawingTool, DiagonalDirection } from '../types';

describe('DimensionControls Component', () => {
    const mockState: State = {
        config: {
            maxFolds: 3,
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

    test('renders dimension controls', () => {
        render(<DimensionControls state={mockState} dispatch={mockDispatch} />);

        expect(screen.getByLabelText('Canvas Width:')).toBeInTheDocument();
        expect(screen.getByLabelText('Height:')).toBeInTheDocument();
    });

    test('width input shows current canvas width', () => {
        render(<DimensionControls state={mockState} dispatch={mockDispatch} />);

        const widthInput = screen.getByLabelText('Canvas Width:') as HTMLInputElement;
        expect(widthInput.value).toBe('400');
    });

    test('height input shows current canvas height', () => {
        render(<DimensionControls state={mockState} dispatch={mockDispatch} />);

        const heightInput = screen.getByLabelText('Height:') as HTMLInputElement;
        expect(heightInput.value).toBe('400');
    });

    test('changing width input dispatches SET_CANVAS_DIMENSIONS action', () => {
        render(<DimensionControls state={mockState} dispatch={mockDispatch} />);

        const widthInput = screen.getByLabelText('Canvas Width:');
        fireEvent.change(widthInput, { target: { value: '500' } });

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'SET_CANVAS_DIMENSIONS',
            payload: {
                width: 500,
                height: 400
            }
        });
    });

    test('changing height input dispatches SET_CANVAS_DIMENSIONS action', () => {
        render(<DimensionControls state={mockState} dispatch={mockDispatch} />);

        const heightInput = screen.getByLabelText('Height:');
        fireEvent.change(heightInput, { target: { value: '600' } });

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'SET_CANVAS_DIMENSIONS',
            payload: {
                width: 400,
                height: 600
            }
        });
    });

    test('updating both width and height works correctly', () => {
        // Render with initial state
        const { rerender } = render(<DimensionControls state={mockState} dispatch={mockDispatch} />);

        // Change width
        const widthInput = screen.getByLabelText('Canvas Width:') as HTMLInputElement;
        fireEvent.change(widthInput, { target: { value: '500' } });

        // Verify dispatch was called
        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'SET_CANVAS_DIMENSIONS',
            payload: {
                width: 500,
                height: 400
            }
        });

        // Create updated state with new width
        const updatedStateWidth = {
            ...mockState,
            canvasDimensions: {
                width: 500,
                height: 400
            }
        };

        // Re-render with updated state
        rerender(<DimensionControls state={updatedStateWidth} dispatch={mockDispatch} />);

        // Verify width input is updated
        expect(widthInput.value).toBe('500');

        // Now change height
        const heightInput = screen.getByLabelText('Height:') as HTMLInputElement;
        fireEvent.change(heightInput, { target: { value: '600' } });

        // Verify dispatch was called
        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'SET_CANVAS_DIMENSIONS',
            payload: {
                width: 500,
                height: 600
            }
        });

        // Create updated state with new height
        const updatedStateBoth = {
            ...updatedStateWidth,
            canvasDimensions: {
                width: 500,
                height: 600
            }
        };

        // Re-render with fully updated state
        rerender(<DimensionControls state={updatedStateBoth} dispatch={mockDispatch} />);

        // Verify both inputs are updated
        expect(widthInput.value).toBe('500');
        expect(heightInput.value).toBe('600');
    });
}); 