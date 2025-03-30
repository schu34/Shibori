/* eslint-disable react-refresh/only-export-components */
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { initialState } from './store/shiboriCanvasState';

// Create a simple mock store for testing
export const createTestStore = () => {
    return configureStore({
        reducer: {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            shibori: (state = initialState, action) => state
        }
    });
};

// Create a provider wrapper for testing
export const ReduxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const store = createTestStore();
    return <Provider store={store}>{children}</Provider>;
};

// Custom render function that wraps component with Redux Provider
export function renderWithRedux(
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>
) {
    return render(ui, { wrapper: ReduxProvider, ...options });
} 