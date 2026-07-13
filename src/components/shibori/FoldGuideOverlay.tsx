import React from 'react';
import { DiagonalDirection, FoldState } from '../../types';

interface FoldGuideOverlayProps {
    canvasDimensions: { width: number; height: number };
    folds: FoldState;
    showGrid?: boolean;
    style?: React.CSSProperties;
}

/**
 * Visual-only crease guides. These deliberately sit above a canvas instead of
 * drawing into it, so the folded artwork and exported unfolded pattern stay
 * free of UI marks.
 */
export const FoldGuideOverlay: React.FC<FoldGuideOverlayProps> = ({
    canvasDimensions,
    folds,
    showGrid = false,
    style,
}) => {
    const verticalPositions = showGrid ? getGuidePositions(folds.vertical) : [];
    const horizontalPositions = showGrid ? getGuidePositions(folds.horizontal) : [];
    const showDiagonal = folds.diagonal.enabled &&
        folds.diagonal.count === 1 &&
        folds.vertical === folds.horizontal;

    if (!showDiagonal && verticalPositions.length === 0 && horizontalPositions.length === 0) {
        return null;
    }

    const { width, height } = canvasDimensions;
    const diagonalSegments = showDiagonal
        ? getDiagonalGuideSegments(width, height, folds, showGrid)
        : [];

    return (
        <svg
            className="fold-guide-overlay"
            style={style}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
        >
            {verticalPositions.map((position) => (
                <line
                    key={`vertical-${position}`}
                    className="fold-guide-line fold-guide-vertical"
                    x1={width * position}
                    y1="0"
                    x2={width * position}
                    y2={height}
                />
            ))}
            {horizontalPositions.map((position) => (
                <line
                    key={`horizontal-${position}`}
                    className="fold-guide-line fold-guide-horizontal"
                    x1="0"
                    y1={height * position}
                    x2={width}
                    y2={height * position}
                />
            ))}
            {diagonalSegments.map((segment) => (
                <line
                    key={segment.key}
                    className="fold-guide-line fold-guide-diagonal"
                    x1={segment.x1}
                    y1={segment.y1}
                    x2={segment.x2}
                    y2={segment.y2}
                />
            ))}
        </svg>
    );
};

function getGuidePositions(foldCount: number): number[] {
    const segments = Math.pow(2, foldCount);
    return Array.from({ length: Math.max(0, segments - 1) }, (_, index) => (index + 1) / segments);
}

interface GuideSegment {
    key: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

function getDiagonalGuideSegments(
    width: number,
    height: number,
    folds: FoldState,
    tileForUnfoldedCanvas: boolean
): GuideSegment[] {
    const sourceIsTopRightToBottomLeft = folds.diagonal.direction === DiagonalDirection.TopRightToBottomLeft;

    if (!tileForUnfoldedCanvas) {
        return [getDiagonalGuideSegment(width, height, sourceIsTopRightToBottomLeft, 0, 0, 'diagonal')];
    }

    const gridWidth = Math.pow(2, folds.vertical);
    const gridHeight = Math.pow(2, folds.horizontal);
    const cellWidth = width / gridWidth;
    const cellHeight = height / gridHeight;
    const segments: GuideSegment[] = [];

    for (let row = 0; row < gridHeight; row++) {
        for (let column = 0; column < gridWidth; column++) {
            const isMirrored = (row + column) % 2 === 1;
            segments.push(getDiagonalGuideSegment(
                cellWidth,
                cellHeight,
                isMirrored ? !sourceIsTopRightToBottomLeft : sourceIsTopRightToBottomLeft,
                column * cellWidth,
                row * cellHeight,
                `diagonal-${row}-${column}`
            ));
        }
    }

    return segments;
}

function getDiagonalGuideSegment(
    width: number,
    height: number,
    topRightToBottomLeft: boolean,
    offsetX: number,
    offsetY: number,
    key: string
): GuideSegment {
    return {
        key,
        x1: offsetX + (topRightToBottomLeft ? width : 0),
        y1: offsetY,
        x2: offsetX + (topRightToBottomLeft ? 0 : width),
        y2: offsetY + height,
    };
}
