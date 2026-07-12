import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { ShareControls } from '../components/shibori/ShareControls';
import { createAppStore } from '../store';
import { ActionType, initialState } from '../store/shiboriCanvasState';
import { DrawingTool } from '../types';

function renderShareControls(pointCount: number) {
  const store = createAppStore({
    shibori: {
      ...initialState,
      history: [{
        id: 'shared-brush',
        action: DrawingTool.Paintbrush,
        points: Array.from({ length: pointCount }, (_, index) => ({
          x: index * 0.123456789 + Math.sin(index * 1.91) * 0.000001,
          y: (index * 7919.1234567) % 1600 + Math.cos(index * 2.17) * 0.000001,
        })),
        style: { lineThickness: 12, color: '#fafafa' },
      }],
    },
  });

  return { store, ...render(<Provider store={store}><ShareControls /></Provider>) };
}

describe('ShareControls', () => {
  test('shows a compressed z3 share URL for a small design', () => {
    renderShareControls(2);

    fireEvent.click(screen.getByRole('button', { name: 'Generate Share Link' }));

    expect((screen.getByRole('textbox') as HTMLInputElement).value).toContain('shared=z3.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('updates the live size after committed drawing history changes', () => {
    const { store } = renderShareControls(2);
    const initialSize = screen.getByTestId('share-link-size').textContent;

    act(() => {
      store.dispatch({
        type: ActionType.ADD_HISTORY_ITEM,
        payload: {
          action: DrawingTool.Paintbrush,
          points: Array.from({ length: 100 }, (_, index) => ({
            x: index * 7.123456789,
            y: (index * 73.987654321) % 1600,
          })),
          style: { lineThickness: 12, color: '#fafafa' },
        },
      });
    });

    expect(screen.getByTestId('share-link-size')).toHaveTextContent('Live link size');
    expect(screen.getByTestId('share-link-size').textContent).not.toBe(initialSize);
  });

  test('shows an accessible size-limit error without exposing a root-only link', () => {
    renderShareControls(1_000);

    fireEvent.click(screen.getByRole('button', { name: 'Generate Share Link' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'This design is too large for a share link (6 KiB limit).'
    );
    expect(screen.getByTestId('share-link-size')).toHaveClass('share-link-size-over-limit');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
