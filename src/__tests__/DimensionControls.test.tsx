import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DimensionControls } from '../components/shibori/DimensionControls';
import { State } from '../store/shiboriCanvasState';
import { DrawingTool } from '../types';

describe('DimensionControls Component', () => {
    const mockState: State = {
        config: {
            maxFolds: 3,
            unfoldedCanvasWidth: 400,
            unfoldedCanvasHeight: 400,
            defaultCircleRadius: 20,
            circleColor: 'white',
            defaultLineThickness: 2,
            lineColor: 'white',
        },
        folds: {
            vertical: 2,
            horizontal: 1
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

    test('changing width input dispatches both UPDATE and SET actions', () => {
        render(<DimensionControls state={mockState} dispatch={mockDispatch} />);

        const widthInput = screen.getByLabelText('Canvas Width:');
        fireEvent.change(widthInput, { target: { value: '500' } });

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'UPDATE_CANVAS_WIDTH',
            payload: 500
        });

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'SET_CANVAS_DIMENSIONS',
            payload: {
                width: 500,
                height: 400
            }
        });
    });

    test('changing height input dispatches both UPDATE and SET actions', () => {
        render(<DimensionControls state={mockState} dispatch={mockDispatch} />);

        const heightInput = screen.getByLabelText('Height:');
        fireEvent.change(heightInput, { target: { value: '600' } });

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'UPDATE_CANVAS_HEIGHT',
            payload: 600
        });

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'SET_CANVAS_DIMENSIONS',
            payload: {
                width: 400,
                height: 600
            }
        });
    });
}); 