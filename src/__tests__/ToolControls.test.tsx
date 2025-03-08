import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToolControls } from '../components/shibori/ToolControls';
import { State } from '../store/shiboriCanvasState';
import { DrawingTool } from '../types';

describe('ToolControls Component', () => {
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

    test('renders tool controls', () => {
        render(<ToolControls state={mockState} dispatch={mockDispatch} />);

        expect(screen.getByText('Drawing Tool:')).toBeInTheDocument();
        expect(screen.getByText('Circle Brush')).toBeInTheDocument();
        expect(screen.getByText('Line Tool')).toBeInTheDocument();
    });

    test('shows circle controls when circle tool is selected', () => {
        render(<ToolControls state={mockState} dispatch={mockDispatch} />);

        expect(screen.getByText('Circle Size:')).toBeInTheDocument();
        expect(screen.getByText('20')).toBeInTheDocument();
        expect(screen.getByText(/px$/)).toBeInTheDocument();
    });

    test('shows line controls when line tool is selected', () => {
        const lineToolState: State = {
            ...mockState,
            currentTool: DrawingTool.Line
        };

        render(<ToolControls state={lineToolState} dispatch={mockDispatch} />);

        expect(screen.getByText('Line Thickness:')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText(/px$/)).toBeInTheDocument();
    });

    test('changing tool dispatches SET_CURRENT_TOOL action', () => {
        render(<ToolControls state={mockState} dispatch={mockDispatch} />);

        // Click on the Line Tool radio button
        const lineToolRadio = screen.getByLabelText('Line Tool');
        fireEvent.click(lineToolRadio);

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'SET_CURRENT_TOOL',
            payload: DrawingTool.Line
        });
    });

    test('changing circle size slider dispatches SET_CIRCLE_RADIUS action', () => {
        render(<ToolControls state={mockState} dispatch={mockDispatch} />);

        const sizeSlider = screen.getByLabelText('Circle Size:');
        fireEvent.change(sizeSlider, { target: { value: '30' } });

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'SET_CIRCLE_RADIUS',
            payload: 30
        });
    });
}); 