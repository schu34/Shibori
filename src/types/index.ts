export interface AppConfig {
    maxFolds: number;
    defaultCircleRadius: number;
    circleColor: string;
    defaultLineThickness: number;
    lineColor: string;
}

export enum DiagonalDirection {
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