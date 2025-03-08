export interface AppConfig {
    unfoldedCanvasWidth: number;
    unfoldedCanvasHeight: number;
    maxFolds: number;
    defaultCircleRadius: number;
    circleColor: string;
    defaultLineThickness: number;
    lineColor: string;
}

export interface FoldState {
    vertical: number;
    horizontal: number;
}

export enum DrawingTool {
    Circle = 'circle',
    Line = 'line'
} 