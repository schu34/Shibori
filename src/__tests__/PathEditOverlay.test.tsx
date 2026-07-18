import { render, screen } from '@testing-library/react';
import { PathEditOverlay } from '../components/shibori/PathEditOverlay';

describe('PathEditOverlay', () => {
  test('places anchors and selected handles in a pointer-transparent SVG overlay', () => {
    const { container } = render(<PathEditOverlay
      path={{
        closed: false,
        anchors: [
          {
            id: 'a', point: { x: 10, y: 20 }, inHandle: null,
            outHandle: { x: 30, y: 40 }, kind: 'corner',
          },
          {
            id: 'b', point: { x: 90, y: 80 }, inHandle: { x: 70, y: 60 },
            outHandle: null, kind: 'corner',
          },
        ],
      }}
      selectedAnchorIds={['a']}
      canvasDimensions={{ width: 100, height: 100 }}
    />);

    const overlay = screen.getByTestId('path-edit-overlay');
    expect(overlay).toHaveAttribute('viewBox', '0 0 100 100');
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.path-edit-anchor')).toHaveLength(2);
    expect(container.querySelector('.path-edit-anchor-selected')).toHaveAttribute('cx', '10');
    expect(container.querySelector('.path-edit-anchor-selected')).toHaveAttribute('r', '9');
    expect(container.querySelectorAll('.path-edit-handle')).toHaveLength(1);
    expect(container.querySelector('.path-edit-handle')).toHaveAttribute('r', '7');
    expect(container.querySelector('.path-edit-guide-line')).toHaveAttribute('x2', '30');
  });
});
