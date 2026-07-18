import React from 'react';
import { BezierDrawingGuidance, CanvasDimensions, Point } from '../../types/DrawingMode';

interface BezierGuideOverlayProps {
    guidance: BezierDrawingGuidance;
    canvasDimensions: CanvasDimensions;
    style?: React.CSSProperties;
}

export const BezierGuideOverlay: React.FC<BezierGuideOverlayProps> = ({ guidance, canvasDimensions, style }) => {
    const { width, height } = canvasDimensions;
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
            {guidance.path.anchors.map((anchor) => (
                <g key={anchor.id}>
                    {anchor.inHandle && <GuideLine from={anchor.point} to={anchor.inHandle} />}
                    {anchor.outHandle && <GuideLine from={anchor.point} to={anchor.outHandle} />}
                    {anchor.inHandle && <GuidePoint point={anchor.inHandle} className="bezier-control" />}
                    {anchor.outHandle && <GuidePoint point={anchor.outHandle} className="bezier-control" />}
                    <GuidePoint point={anchor.point} className="bezier-anchor" />
                </g>
            ))}
            {guidance.hoverPoint && guidance.path.anchors.length > 0 && (
                <>
                    <GuideLine
                        from={guidance.path.anchors[guidance.path.anchors.length - 1].point}
                        to={guidance.hoverPoint}
                    />
                    <GuidePoint point={guidance.hoverPoint} className="bezier-control" />
                </>
            )}
        </svg>
    );
};

function GuideLine({ from, to }: { from: Point; to: Point }) {
    return <line className="bezier-guide-line" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
}

function GuidePoint({ point, className }: { point: Point; className: string }) {
    return <circle className={className} cx={point.x} cy={point.y} r="5" />;
}
