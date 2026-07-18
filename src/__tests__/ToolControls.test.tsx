import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { renderWithRedux } from '../testUtils';
import * as reduxHooks from '../hooks/useReduxHooks';
import { ToolControls } from '../components/shibori/ToolControls';
import { ToolSelector } from '../components/shibori/ToolSelector';
import { State } from '../store/shiboriCanvasState';
import { DrawingTool, ShapeFillMode, DiagonalDirection } from '../types';

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
        shapeFillMode: ShapeFillMode.Filled,
        currentTool: DrawingTool.Paintbrush,
        canvasDimensions: {
            width: 400,
            height: 400
        },
        history: [],
        selectedHistoryItemId: null,
        selectionDragDelta: null,
        selectionRotationPreview: null
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

    test('renders contextual controls for the current tool', () => {
        renderWithRedux(<ToolControls />);

        expect(screen.getByLabelText('Brush Thickness:')).toBeInTheDocument();
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

    test('shows fill mode controls when a shape tool is selected', () => {
        const rectangleToolState = {
            ...mockState,
            currentTool: DrawingTool.Rectangle
        };

        jest.spyOn(reduxHooks, 'useAppSelector').mockImplementation(() => rectangleToolState);

        renderWithRedux(<ToolControls />);

        expect(screen.getByText('Shape Fill:')).toBeInTheDocument();
        expect(screen.getByLabelText('Filled')).toBeChecked();
        expect(screen.getByLabelText('Outline')).not.toBeChecked();
    });

    test('changing tool dispatches SET_CURRENT_TOOL action', () => {
        renderWithRedux(<ToolSelector currentTool={DrawingTool.Paintbrush} />);

        // Click on the Line Tool radio button
        const lineToolRadio = screen.getByLabelText('Line Tool');
        fireEvent.click(lineToolRadio);

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'SET_CURRENT_TOOL',
            payload: DrawingTool.Line
        });
    });

    test('select move tool hides drawing-only controls', () => {
        jest.spyOn(reduxHooks, 'useAppSelector').mockImplementation(() => ({
            ...mockState,
            currentTool: DrawingTool.SelectMove
        }));

        renderWithRedux(<ToolControls />);

        expect(screen.queryByText(/Thickness:/)).not.toBeInTheDocument();
        expect(screen.queryByText('Shape Fill:')).not.toBeInTheDocument();
        expect(screen.getByText('This tool has no additional options.')).toBeInTheDocument();
    });

    test('changing to a shape tool dispatches SET_CURRENT_TOOL action', () => {
        renderWithRedux(<ToolSelector currentTool={DrawingTool.Paintbrush} />);

        fireEvent.click(screen.getByLabelText('Rectangle'));

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'SET_CURRENT_TOOL',
            payload: DrawingTool.Rectangle
        });
    });

    test('tool rail exposes icon controls with stable accessible names', () => {
        renderWithRedux(<ToolSelector currentTool={DrawingTool.Paintbrush} />);

        expect(screen.getByRole('group', { name: 'Drawing tools' })).toBeInTheDocument();
        expect(screen.getByLabelText('Paintbrush')).toBeChecked();
        expect(screen.getByLabelText('Select/Move')).not.toBeChecked();
        expect(screen.getByLabelText('Bézier Curve')).toBeInTheDocument();
    });

    test('changing fill mode dispatches SET_SHAPE_FILL_MODE action', () => {
        const rectangleToolState = {
            ...mockState,
            currentTool: DrawingTool.Rectangle
        };

        jest.spyOn(reduxHooks, 'useAppSelector').mockImplementation(() => rectangleToolState);

        renderWithRedux(<ToolControls />);

        fireEvent.click(screen.getByLabelText('Outline'));

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'SET_SHAPE_FILL_MODE',
            payload: ShapeFillMode.Outline
        });
    });

    test('bezier shows line thickness and closed-path fill controls', () => {
        jest.spyOn(reduxHooks, 'useAppSelector').mockImplementation(() => ({
            ...mockState,
            currentTool: DrawingTool.Bezier
        }));

        renderWithRedux(<ToolControls />);

        expect(screen.getByText('Line Thickness:')).toBeInTheDocument();
        expect(screen.getByText('Shape Fill:')).toBeInTheDocument();
    });

}); 
