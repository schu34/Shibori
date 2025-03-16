import React, { useReducer } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DimensionControls } from '../components/shibori/DimensionControls';
import { initialState, reducer } from '../store/shiboriCanvasState';

// Wrapper component that uses the actual reducer
const TestWrapper: React.FC = () => {
    const [state, dispatch] = useReducer(reducer, initialState);

    return (
        <div>
            <DimensionControls state={state} dispatch={dispatch} />
            <div data-testid="current-width">{state.canvasDimensions.width}</div>
            <div data-testid="current-height">{state.canvasDimensions.height}</div>
        </div>
    );
};

describe('Canvas Dimension Updates', () => {
    test('canvas dimensions are updated in state when changed via UI', () => {
        render(<TestWrapper />);

        // Check initial dimensions
        expect(screen.getByTestId('current-width').textContent).toBe(initialState.canvasDimensions.width.toString());
        expect(screen.getByTestId('current-height').textContent).toBe(initialState.canvasDimensions.height.toString());

        // Change width
        const widthInput = screen.getByLabelText('Canvas Width:') as HTMLInputElement;
        fireEvent.change(widthInput, { target: { value: '600' } });

        // Check width was updated in state
        expect(screen.getByTestId('current-width').textContent).toBe('600');
        expect(screen.getByTestId('current-height').textContent).toBe(initialState.canvasDimensions.height.toString());

        // Change height
        const heightInput = screen.getByLabelText('Height:') as HTMLInputElement;
        fireEvent.change(heightInput, { target: { value: '700' } });

        // Check both dimensions were updated in state
        expect(screen.getByTestId('current-width').textContent).toBe('600');
        expect(screen.getByTestId('current-height').textContent).toBe('700');
    });

    test('dimensions are constrained to minimum values', () => {
        render(<TestWrapper />);

        // Try to set width below minimum (100)
        const widthInput = screen.getByLabelText('Canvas Width:') as HTMLInputElement;
        fireEvent.change(widthInput, { target: { value: '50' } });

        // Check that width was constrained to minimum
        expect(screen.getByTestId('current-width').textContent).toBe('100');

        // Try to set height below minimum (100)
        const heightInput = screen.getByLabelText('Height:') as HTMLInputElement;
        fireEvent.change(heightInput, { target: { value: '50' } });

        // Check that height was constrained to minimum
        expect(screen.getByTestId('current-height').textContent).toBe('100');
    });
}); 