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
          startAnchor: { x: 10, y: 20 },
          firstControl: { x: 30, y: 40 },
          endAnchor: { x: 100, y: 20 },
          secondControl: { x: 80, y: 0 },
          endHandle: { x: 120, y: 40 },
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
