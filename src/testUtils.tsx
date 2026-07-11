/* eslint-disable react-refresh/only-export-components */
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createAppStore } from './store';

export const createTestStore = () => createAppStore();

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
