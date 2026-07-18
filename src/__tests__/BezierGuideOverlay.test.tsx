import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BezierGuideOverlay } from '../components/shibori/BezierGuideOverlay';

describe('BezierGuideOverlay', () => {
  test('renders construction geometry as a non-interactive visual overlay', () => {
    const { container } = render(
      <BezierGuideOverlay
        canvasDimensions={{ width: 200, height: 100 }}
        guidance={{
          kind: 'bezier',
          path: {
            closed: false,
            anchors: [
              { id: 'a', point: { x: 10, y: 20 }, inHandle: null, outHandle: { x: 30, y: 40 }, kind: 'corner' },
              { id: 'b', point: { x: 100, y: 20 }, inHandle: { x: 80, y: 0 }, outHandle: { x: 120, y: 40 }, kind: 'smooth' },
            ],
          },
        }}
      />
    );

    const overlay = screen.getByTestId('bezier-guide-overlay');
    expect(overlay).toHaveAttribute('viewBox', '0 0 200 100');
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.bezier-guide-line')).toHaveLength(3);
    expect(container.querySelectorAll('circle')).toHaveLength(5);
  });
});
