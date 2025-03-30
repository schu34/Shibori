import React from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { renderWithRedux } from '../testUtils';
import * as reduxHooks from '../hooks/useReduxHooks';
import { FoldControls } from '../components/shibori/FoldControls';
import { State } from '../store/shiboriCanvasState';
import { DrawingTool, DiagonalDirection } from '../types';

describe('FoldControls Component', () => {
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

    test('renders fold buttons', () => {
        renderWithRedux(<FoldControls />);

        // Find the groups and check their headings
        const foldGroups = screen.getAllByRole('heading');
        const verticalHeading = foldGroups.find(h => h.textContent?.includes('Vertical Folds'));
        const horizontalHeading = foldGroups.find(h => h.textContent?.includes('Horizontal Folds'));

        expect(verticalHeading).toBeInTheDocument();
        expect(horizontalHeading).toBeInTheDocument();
        expect(screen.getByText('Reset Folds')).toBeInTheDocument();

        // Check fold values
        expect(verticalHeading?.textContent).toContain('2');
        expect(horizontalHeading?.textContent).toContain('1');
    });

    test('vertical fold button dispatches correct action', () => {
        renderWithRedux(<FoldControls />);

        // Find the vertical fold group and its first button
        const foldGroups = screen.getAllByRole('heading');
        const verticalHeading = foldGroups.find(h => h.textContent?.includes('Vertical Folds'));
        const verticalGroup = verticalHeading?.closest('.fold-controls-group');

        // Find the fold button within the group
        const foldButton = within(verticalGroup as HTMLElement).getByText('Fold +');
        fireEvent.click(foldButton);

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'UPDATE_FOLD',
            payload: {
                axis: 'vertical',
                value: 3
            }
        });
    });

    test('reset button dispatches correct action', () => {
        renderWithRedux(<FoldControls />);

        fireEvent.click(screen.getByText('Reset Folds'));

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'RESET_FOLDS'
        });
    });

    test('disables fold button when max folds is reached', () => {
        // Create state with max vertical folds
        const stateWithMaxFolds = {
            ...mockState,
            folds: {
                ...mockState.folds,
                vertical: 3 // Max folds
            }
        };

        // Override the mock for this test only
        jest.spyOn(reduxHooks, 'useAppSelector').mockImplementation(() => stateWithMaxFolds);

        renderWithRedux(<FoldControls />);

        // Find the vertical fold group and check its content
        const foldGroups = screen.getAllByRole('heading');
        const verticalHeading = foldGroups.find(h => h.textContent?.includes('Vertical Folds'));
        const verticalGroup = verticalHeading?.closest('.fold-controls-group');

        // Check that the value is 3 in the UI and the fold button is disabled
        expect(verticalHeading?.textContent).toContain('3');

        // Find the fold button within the group
        const foldButton = within(verticalGroup as HTMLElement).getByText('Fold +');
        expect(foldButton).toBeDisabled();
    });
}); 