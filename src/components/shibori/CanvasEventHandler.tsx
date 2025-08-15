import React, { useEffect } from 'react';
import { logger } from '../../utils/logger';

interface CanvasEventHandlerProps {
    foldedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    onTouchStart: (e: React.TouchEvent<HTMLCanvasElement>) => void;
    onTouchMove: (e: React.TouchEvent<HTMLCanvasElement>) => void;
    onTouchEnd: (e: React.TouchEvent<HTMLCanvasElement>) => void;
    onTouchCancel: (e: React.TouchEvent<HTMLCanvasElement>) => void;
}

/**
 * Handles touch events for the canvas with proper passive event handling
 * This component is responsible only for setting up touch event listeners
 */
export const CanvasEventHandler: React.FC<CanvasEventHandlerProps> = ({
    foldedCanvasRef,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel
}) => {
    // Add touch event listeners with passive: false to ensure preventDefault works
    useEffect(() => {
        const foldedCanvas = foldedCanvasRef.current;
        if (!foldedCanvas) {
            logger.canvas.operation('no folded canvas ref available for touch events');
            return;
        }

        logger.canvas.operation('setting up touch event listeners');

        // Options for the event listeners - critical for making preventDefault work
        const options = { passive: false };

        // Convert React touch event handlers to DOM event handlers
        const touchStartHandler = (e: TouchEvent) => onTouchStart(e as unknown as React.TouchEvent<HTMLCanvasElement>);
        const touchMoveHandler = (e: TouchEvent) => onTouchMove(e as unknown as React.TouchEvent<HTMLCanvasElement>);
        const touchEndHandler = (e: TouchEvent) => onTouchEnd(e as unknown as React.TouchEvent<HTMLCanvasElement>);
        const touchCancelHandler = (e: TouchEvent) => onTouchCancel(e as unknown as React.TouchEvent<HTMLCanvasElement>);

        // Add event listeners with non-passive option
        foldedCanvas.addEventListener('touchstart', touchStartHandler, options);
        foldedCanvas.addEventListener('touchmove', touchMoveHandler, options);
        foldedCanvas.addEventListener('touchend', touchEndHandler, options);
        foldedCanvas.addEventListener('touchcancel', touchCancelHandler, options);

        // Clean up event listeners when component unmounts
        return () => {
            logger.canvas.operation('cleaning up touch event listeners');
            foldedCanvas.removeEventListener('touchstart', touchStartHandler);
            foldedCanvas.removeEventListener('touchmove', touchMoveHandler);
            foldedCanvas.removeEventListener('touchend', touchEndHandler);
            foldedCanvas.removeEventListener('touchcancel', touchCancelHandler);
        };
    }, [onTouchStart, onTouchMove, onTouchEnd, onTouchCancel, foldedCanvasRef]);

    // This component renders nothing - it only manages event listeners
    return null;
};