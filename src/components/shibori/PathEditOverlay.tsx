import React from 'react';
import { BezierPath, CanvasDimensions, Point } from '../../types/DrawingMode';

interface PathEditOverlayProps {
  path: BezierPath;
  selectedAnchorIds: string[];
  canvasDimensions: CanvasDimensions;
  style?: React.CSSProperties;
}

export const PathEditOverlay: React.FC<PathEditOverlayProps> = ({
  path,
  selectedAnchorIds,
  canvasDimensions,
  style,
}) => {
  const selected = new Set(selectedAnchorIds);
  return (
    <svg
      className="path-edit-overlay"
      style={style}
      viewBox={`0 0 ${canvasDimensions.width} ${canvasDimensions.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      data-testid="path-edit-overlay"
    >
      {path.anchors.map((anchor) => {
        const isSelected = selected.has(anchor.id);
        return (
          <g key={anchor.id}>
            {isSelected && anchor.inHandle && <GuideLine from={anchor.point} to={anchor.inHandle} />}
            {isSelected && anchor.outHandle && <GuideLine from={anchor.point} to={anchor.outHandle} />}
            {isSelected && anchor.inHandle && <GuidePoint point={anchor.inHandle} className="path-edit-handle" radius={7} />}
            {isSelected && anchor.outHandle && <GuidePoint point={anchor.outHandle} className="path-edit-handle" radius={7} />}
            <GuidePoint
              point={anchor.point}
              className={`path-edit-anchor${isSelected ? ' path-edit-anchor-selected' : ''}`}
              radius={9}
            />
          </g>
        );
      })}
    </svg>
  );
};

function GuideLine({ from, to }: { from: Point; to: Point }) {
  return <line className="path-edit-guide-line" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
}

function GuidePoint({ point, className, radius }: { point: Point; className: string; radius: number }) {
  return <circle className={className} cx={point.x} cy={point.y} r={radius} />;
}
