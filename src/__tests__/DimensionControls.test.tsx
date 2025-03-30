import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DimensionControls } from '../components/shibori/DimensionControls';
import { renderWithRedux } from '../testUtils';
import * as reduxHooks from '../hooks/useReduxHooks';
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
                direction: DiagonalDirection.TopRightToBottomLeft
            }
        },
        circleRadius: 20,
        lineThickness: 2,
        currentTool: DrawingTool.Circle,
        isDrawing: false,
        lineStartPoint: null,
        currentStrokePoints: [],
        canvasDimensions: {
            width: 400,
            height: 400
        }
    };

    const mockDispatch = jest.fn();

    beforeEach(() => {
        mockDispatch.mockClear();
        // Mock the Redux hooks
        jest.spyOn(reduxHooks, 'useAppSelector').mockImplementation(() => mockState);
        jest.spyOn(reduxHooks, 'useAppDispatch').mockImplementation(() => mockDispatch);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders dimension controls', () => {
        renderWithRedux(<DimensionControls />);

        expect(screen.getByLabelText('Canvas Width:')).toBeInTheDocument();
        expect(screen.getByLabelText('Height:')).toBeInTheDocument();
    });

    test('width input shows current canvas width', () => {
        renderWithRedux(<DimensionControls />);

        const widthInput = screen.getByLabelText('Canvas Width:') as HTMLInputElement;
        expect(widthInput.value).toBe('400');
    });

    test('height input shows current canvas height', () => {
        renderWithRedux(<DimensionControls />);

        const heightInput = screen.getByLabelText('Height:') as HTMLInputElement;
        expect(heightInput.value).toBe('400');
    });

    test('changing width input dispatches SET_CANVAS_DIMENSIONS action', () => {
        renderWithRedux(<DimensionControls />);

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
        renderWithRedux(<DimensionControls />);

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

    test('updating width and height changes are dispatched correctly', () => {
        renderWithRedux(<DimensionControls />);

        // Change width and verify dispatch
        const widthInput = screen.getByLabelText('Canvas Width:');
        fireEvent.change(widthInput, { target: { value: '500' } });

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'SET_CANVAS_DIMENSIONS',
            payload: {
                width: 500,
                height: 400
            }
        });

        // Reset the mock to check for the next call
        mockDispatch.mockClear();

        // Now update our mock state to reflect the new width
        mockState.canvasDimensions.width = 500;

        // Change height and verify dispatch with the updated width
        const heightInput = screen.getByLabelText('Height:');
        fireEvent.change(heightInput, { target: { value: '600' } });

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'SET_CANVAS_DIMENSIONS',
            payload: {
                width: 500,  // Should use the updated width
                height: 600
            }
        });
    });
}); 