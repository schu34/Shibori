import type { FoldState } from '../types';

export interface CanvasDimensions {
  width: number;
  height: number;
}

/**
 * Size the folded canvas to the shape of one folded cell, while retaining the
 * original backing resolution whenever the horizontal and vertical fold counts
 * match. Shared folds are represented by the mirror downsampling step; only
 * the unmatched folds change the folded canvas aspect ratio.
 */
export function getFoldedCanvasDimensions(
  dimensions: CanvasDimensions,
  folds: Pick<FoldState, 'vertical' | 'horizontal'>
): CanvasDimensions {
  const sharedFolds = Math.min(folds.vertical, folds.horizontal);
  const horizontalOnlyFolds = folds.horizontal - sharedFolds;
  const verticalOnlyFolds = folds.vertical - sharedFolds;

  return {
    width: scaleDimension(dimensions.width, verticalOnlyFolds),
    height: scaleDimension(dimensions.height, horizontalOnlyFolds),
  };
}

function scaleDimension(dimension: number, folds: number): number {
  return Math.max(1, Math.floor(dimension / Math.pow(2, folds)));
}
