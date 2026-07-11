/**
 * Unit tests for WebGL Controls component
 * Tests mode selection, state management, and UI interactions
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { WebGLControls } from '../components/shibori/WebGLControls';
import { Action, initialState, reducer as shiboriReducer } from '../store/shiboriCanvasState';
import { DrawingModeFactory } from '../drawingModes/DrawingModeFactory';
import { WebGLCanvasService } from '../services/WebGLCanvasService';

// Mock WebGL services
jest.mock('../services/WebGLCanvasService', () => ({
  WebGLCanvasService: {
    isWebGLAvailable: jest.fn(() => true),
    hasWebGLInitializationFailed: jest.fn(() => false),
    isWebGLInitialized: jest.fn(() => false),
    getWebGLInfo: jest.fn(() => 'WebGL 2.0 - Test Renderer'),
    forceWebGLMode: jest.fn(),
  }
}));

// Mock DrawingModeFactory
jest.mock('../drawingModes/DrawingModeFactory', () => ({
  DrawingModeFactory: {
    getConfig: jest.fn(() => ({ renderingMode: 'auto' })),
    configure: jest.fn(),
  }
}));

const createTestStore = () => {
  return configureStore({
    reducer: {
      shibori: (state = initialState, action) => shiboriReducer(state, action as Action),
    },
  });
};

const renderWithProvider = (component: React.ReactElement) => {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('WebGLControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(WebGLCanvasService.isWebGLAvailable).mockReturnValue(true);
    jest.mocked(WebGLCanvasService.hasWebGLInitializationFailed).mockReturnValue(false);
    jest.mocked(WebGLCanvasService.isWebGLInitialized).mockReturnValue(false);
    jest.mocked(WebGLCanvasService.getWebGLInfo).mockReturnValue('WebGL 2.0 - Test Renderer');
    (DrawingModeFactory.getConfig as jest.Mock).mockReturnValue({ renderingMode: 'auto' });
  });

  describe('Component Rendering', () => {
    it('renders the rendering mode selector', () => {
      renderWithProvider(<WebGLControls />);
      
      expect(screen.getByText('Rendering')).toBeInTheDocument();
      expect(screen.getByText('Auto')).toBeInTheDocument();
      expect(screen.getByText('WebGL')).toBeInTheDocument();
      expect(screen.getByText('Canvas 2D')).toBeInTheDocument();
    });

    it('shows the current mode as active', () => {
      renderWithProvider(<WebGLControls />);
      
      const autoButton = screen.getByText('Auto');
      expect(autoButton).toHaveClass('active');
    });

    it('enables WebGL button when WebGL is available', () => {
      renderWithProvider(<WebGLControls />);
      
      const webglButton = screen.getByText('WebGL');
      expect(webglButton).not.toBeDisabled();
    });
  });

  describe('Mode Selection', () => {
    it('changes mode when clicking WebGL button', () => {
      renderWithProvider(<WebGLControls />);
      
      const webglButton = screen.getByText('WebGL');
      fireEvent.click(webglButton);
      
      expect(DrawingModeFactory.configure).toHaveBeenCalledWith({ renderingMode: 'webgl' });
      expect(webglButton).toHaveClass('active');
    });

    it('changes mode when clicking Canvas 2D button', () => {
      renderWithProvider(<WebGLControls />);
      
      const canvas2dButton = screen.getByText('Canvas 2D');
      fireEvent.click(canvas2dButton);
      
      expect(DrawingModeFactory.configure).toHaveBeenCalledWith({ renderingMode: 'canvas2d' });
      expect(canvas2dButton).toHaveClass('active');
    });

    it('changes mode when clicking Auto button', () => {
      // Start with WebGL mode selected
      (DrawingModeFactory.getConfig as jest.Mock).mockReturnValue({ renderingMode: 'webgl' });
      
      renderWithProvider(<WebGLControls />);
      
      const autoButton = screen.getByText('Auto');
      fireEvent.click(autoButton);
      
      expect(DrawingModeFactory.configure).toHaveBeenCalledWith({ renderingMode: 'auto' });
    });
  });

  describe('WebGL Availability States', () => {
    it('disables WebGL button when WebGL is not available', () => {
      jest.mocked(WebGLCanvasService.isWebGLAvailable).mockReturnValue(false);
      
      renderWithProvider(<WebGLControls />);
      
      const webglButton = screen.getByText('WebGL');
      expect(webglButton).toBeDisabled();
      expect(webglButton).toHaveAttribute('title', 'WebGL not available');
    });

    it('shows appropriate title when WebGL is available', () => {
      renderWithProvider(<WebGLControls />);
      
      const webglButton = screen.getByText('WebGL');
      expect(webglButton).toHaveAttribute('title', 'Force WebGL rendering');
    });
  });

  describe('Details Panel', () => {
    it('toggles details panel when clicking details button', () => {
      renderWithProvider(<WebGLControls />);
      
      const detailsButton = screen.getByTitle('Show details');
      fireEvent.click(detailsButton);
      
      expect(screen.getByText('Performance Benefits')).toBeInTheDocument();
      expect(screen.getByText('GPU-accelerated drawing')).toBeInTheDocument();
    });

    it('shows WebGL info when details are expanded', () => {
      renderWithProvider(<WebGLControls />);
      
      const detailsButton = screen.getByTitle('Show details');
      fireEvent.click(detailsButton);
      
      expect(screen.getAllByText('WebGL 2.0 - Test Renderer').length).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitor', () => {
    it('toggles performance monitor when clicking performance button', () => {
      renderWithProvider(<WebGLControls />);
      
      const performanceButton = screen.getByTitle('Show performance');
      fireEvent.click(performanceButton);
      
      expect(screen.getByText('Performance Monitor')).toBeInTheDocument();
    });
  });
});
