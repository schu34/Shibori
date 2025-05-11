import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { renderWithRedux } from '../testUtils';
import * as reduxHooks from '../hooks/useReduxHooks';
import { ToolControls } from '../components/shibori/ToolControls';
import { State } from '../store/shiboriCanvasState';
import { DrawingTool, DiagonalDirection } from '../types';

describe('ToolControls Component', () => {
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
        currentTool: DrawingTool.Paintbrush,
        isDrawing: false,
        lineStartPoint: null,
        currentStrokePoints: [],
        canvasDimensions: {
            width: 400,
            height: 400
        },
        history: []
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

    test('renders tool controls', () => {
        renderWithRedux(<ToolControls />);

        expect(screen.getByText('Drawing Tool:')).toBeInTheDocument();
        expect(screen.getByText('Line Tool')).toBeInTheDocument();
    });

    test('shows line controls when line tool is selected', () => {
        // Create state with line tool selected
        const lineToolState = {
            ...mockState,
            currentTool: DrawingTool.Line
        };

        // Override the mock for this test
        jest.spyOn(reduxHooks, 'useAppSelector').mockImplementation(() => lineToolState);

        renderWithRedux(<ToolControls />);

        // Check for line thickness controls
        // The component might be displaying the label differently than expected
        // Let's try to find by label text content that contains "Thickness"
        const thicknessLabel = screen.getAllByText(/thickness/i)[0];
        expect(thicknessLabel).toBeInTheDocument();

        // Check for the thickness value and unit
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText(/px$/)).toBeInTheDocument();
    });

    test('changing tool dispatches SET_CURRENT_TOOL action', () => {
        renderWithRedux(<ToolControls />);

        // Click on the Line Tool radio button
        const lineToolRadio = screen.getByLabelText('Line Tool');
        fireEvent.click(lineToolRadio);

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'SET_CURRENT_TOOL',
            payload: DrawingTool.Line
        });
    });

}); 