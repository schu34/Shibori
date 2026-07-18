import React from 'react';
import { BezierDrawingGuidance, CanvasDimensions, Point } from '../../types/DrawingMode';

interface BezierGuideOverlayProps {
    guidance: BezierDrawingGuidance;
    canvasDimensions: CanvasDimensions;
    style?: React.CSSProperties;
}

export const BezierGuideOverlay: React.FC<BezierGuideOverlayProps> = ({
    guidance,
    canvasDimensions,
    style,
}) => {
    const { width, height } = canvasDimensions;
    const { startAnchor, firstControl, endAnchor, secondControl, endHandle } = guidance;

    return (
        <svg
            className="bezier-guide-overlay"
            style={style}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
            data-testid="bezier-guide-overlay"
        >
            <GuideLine from={startAnchor} to={firstControl} />
            {endAnchor && secondControl && <GuideLine from={endAnchor} to={secondControl} />}
            {endAnchor && endHandle && <GuideLine from={endAnchor} to={endHandle} />}
            <GuidePoint point={startAnchor} className="bezier-anchor" />
            <GuidePoint point={firstControl} className="bezier-control" />
            {endAnchor && <GuidePoint point={endAnchor} className="bezier-anchor" />}
            {secondControl && <GuidePoint point={secondControl} className="bezier-control" />}
            {endHandle && <GuidePoint point={endHandle} className="bezier-control bezier-drag-handle" />}
        </svg>
    );
};

function GuideLine({ from, to }: { from: Point; to: Point }) {
    return <line className="bezier-guide-line" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
}

function GuidePoint({ point, className }: { point: Point; className: string }) {
    return <circle className={className} cx={point.x} cy={point.y} r="5" />;
}
