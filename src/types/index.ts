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
    Line = 'line',
    Paintbrush = 'paintbrush',
    Rectangle = 'rectangle',
    Square = 'square',
    Circle = 'circle',
    Bezier = 'bezier',
    SelectMove = 'selectMove'
} 

export enum HistoryAction {
    Clear = 'clear',
    Move = 'move',
    Rotate = 'rotate',
    Delete = 'delete'
}

export enum ShapeFillMode {
    Filled = 'filled',
    Outline = 'outline'
}
