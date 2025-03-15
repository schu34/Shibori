export interface AppConfig {
    unfoldedCanvasWidth: number;
    unfoldedCanvasHeight: number;
    maxFolds: number;
    defaultCircleRadius: number;
    circleColor: string;
    defaultLineThickness: number;
    lineColor: string;
}

export enum DiagonalDirection {
    TopLeftToBottomRight = 'topLeftToBottomRight',
    TopRightToBottomLeft = 'topRightToBottomLeft'
}

export interface FoldState {
    vertical: number;
    horizontal: number;
    diagonal: {
        enabled: boolean;
        count: number;
        direction: DiagonalDirection;
    };
}

export enum DrawingTool {
    Circle = 'circle',
    Line = 'line'
} 