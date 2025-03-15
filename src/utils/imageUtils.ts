// Image manipulation utilities
export const ImageUtils = {
    // Get RGBA values at a specific pixel position
    getPixel(imageData: ImageData, x: number, y: number): Uint8ClampedArray {
        const index = (y * imageData.width + x) * 4;
        return imageData.data.slice(index, index + 4);
    },

    // Set RGBA values at a specific pixel position
    setPixel(imageData: ImageData, x: number, y: number, rgba: Uint8ClampedArray): void {
        const index = (y * imageData.width + x) * 4;
        for (let i = 0; i < 4; i++) {
            imageData.data[index + i] = rgba[i];
        }
    },

    // Copy a pixel from source to target
    copyPixel(source: ImageData, sourceX: number, sourceY: number,
        target: ImageData, targetX: number, targetY: number): void {
        const rgba = this.getPixel(source, sourceX, sourceY);
        this.setPixel(target, targetX, targetY, rgba);
    },

    // Flip image data horizontally
    flipHorizontal(imageData: ImageData): ImageData {
        const { width, height } = imageData;
        const result = new ImageData(width, height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                this.copyPixel(
                    imageData, x, y,
                    result, width - x - 1, y
                );
            }
        }

        return result;
    },

    // Flip image data vertically
    flipVertical(imageData: ImageData): ImageData {
        const { width, height } = imageData;
        const result = new ImageData(width, height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                this.copyPixel(
                    imageData, x, y,
                    result, x, height - y - 1
                );
            }
        }

        return result;
    },

    // Flip image diagonally from top-left to bottom-right
    flipDiagonalTopLeftToBottomRight(imageData: ImageData): ImageData {
        // For diagonal flip, width and height are swapped
        const { width, height } = imageData;
        const result = new ImageData(height, width);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Transpose the coordinates (x,y) -> (y,x)
                this.copyPixel(
                    imageData, x, y,
                    result, y, x
                );
            }
        }

        return result;
    },

    // Flip image diagonally from top-right to bottom-left
    flipDiagonalTopRightToBottomLeft(imageData: ImageData): ImageData {
        // For diagonal flip, width and height are swapped
        const { width, height } = imageData;
        const result = new ImageData(height, width);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Transpose and flip (x,y) -> (height-y-1, width-x-1)
                this.copyPixel(
                    imageData, x, y,
                    result, height - y - 1, width - x - 1
                );
            }
        }

        return result;
    },

    // Combine two image data objects horizontally
    combineHorizontal(left: ImageData, right: ImageData): ImageData {
        if (left.height !== right.height) {
            throw new Error('Images must have the same height to combine horizontally');
        }

        const newWidth = left.width + right.width;
        const result = new ImageData(newWidth, left.height);

        // Copy left image
        for (let y = 0; y < left.height; y++) {
            for (let x = 0; x < left.width; x++) {
                this.copyPixel(
                    left, x, y,
                    result, x, y
                );
            }
        }

        // Copy right image
        for (let y = 0; y < right.height; y++) {
            for (let x = 0; x < right.width; x++) {
                this.copyPixel(
                    right, x, y,
                    result, x + left.width, y
                );
            }
        }

        return result;
    },

    // Combine two image data objects vertically
    combineVertical(top: ImageData, bottom: ImageData): ImageData {
        if (top.width !== bottom.width) {
            throw new Error('Images must have the same width to combine vertically');
        }

        const newHeight = top.height + bottom.height;
        const result = new ImageData(top.width, newHeight);

        // Copy top image
        for (let y = 0; y < top.height; y++) {
            for (let x = 0; x < top.width; x++) {
                this.copyPixel(
                    top, x, y,
                    result, x, y
                );
            }
        }

        // Copy bottom image
        for (let y = 0; y < bottom.height; y++) {
            for (let x = 0; x < bottom.width; x++) {
                this.copyPixel(
                    bottom, x, y,
                    result, x, y + top.height
                );
            }
        }

        return result;
    },
}; 