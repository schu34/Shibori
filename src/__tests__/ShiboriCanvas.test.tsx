import React from 'react';
import { } from '@testing-library/react';
import { renderWithRedux } from '../testUtils';import { screen } from '@testing-library/dom';
import * as reduxHooks from '../hooks/useReduxHooks';import '@testing-library/jest-dom';
import ShiboriCanvas from '../components/ShiboriCanvas';

// Mock the child components to isolate the main component in tests
jest.mock('../components/shibori/FoldControls', () => ({
    FoldControls: () => <div data-testid="mock-fold-controls">Fold Controls</div>
}));

jest.mock('../components/shibori/DimensionControls', () => ({
    DimensionControls: () => <div data-testid="mock-dimension-controls">Dimension Controls</div>
}));

jest.mock('../components/shibori/CanvasDisplay', () => ({
    CanvasDisplay: () => <div data-testid="mock-canvas-display">Canvas Display</div>
}));

jest.mock('../components/shibori/ToolControls', () => ({
    ToolControls: () => <div data-testid="mock-tool-controls">Tool Controls</div>
}));

describe('ShiboriCanvas Component', () => {
    test('renders without crashing', () => {
        renderWithRedux(<ShiboriCanvas />);

        // Check if the component renders its title
        expect(screen.getByText('Folded Paper Drawing')).toBeInTheDocument();

        // Check if all child components are rendered
        expect(screen.getByTestId('mock-fold-controls')).toBeInTheDocument();
        expect(screen.getByTestId('mock-dimension-controls')).toBeInTheDocument();
        expect(screen.getByTestId('mock-canvas-display')).toBeInTheDocument();
        expect(screen.getByTestId('mock-tool-controls')).toBeInTheDocument();
    });
}); 