import { ImageUtils } from '../utils/imageUtils';

class TestImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;

  constructor(widthOrData: number | Uint8ClampedArray, width: number, height?: number) {
    if (typeof widthOrData === 'number') {
      this.width = widthOrData;
      this.height = width;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
      return;
    }

    this.data = widthOrData;
    this.width = width;
    this.height = height ?? Math.floor(widthOrData.length / 4 / width);
  }
}

describe('diagonal fold pixel semantics', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'ImageData', {
      configurable: true,
      writable: true,
      value: TestImageData,
    });
  });

  test('anti-diagonal keeps the drawable lower-right mark and reflects it upper-left', () => {
    const image = navyImage(4, 4);
    setPixel(image, 3, 2, [255, 255, 255, 255]);

    const mirrored = ImageUtils.mirrorDiagonalTopRightToBottomLeft(image);

    expect(pixelAt(mirrored, 3, 2)).toEqual([255, 255, 255, 255]);
    expect(pixelAt(mirrored, 1, 0)).toEqual([255, 255, 255, 255]);
    expect(pixelAt(mirrored, 0, 1)).toEqual([0, 0, 128, 255]);
  });

  test('main diagonal keeps the upper-right mark and reflects it lower-left', () => {
    const image = navyImage(4, 4);
    setPixel(image, 3, 1, [255, 255, 255, 255]);

    const mirrored = ImageUtils.mirrorDiagonalTopLeftToBottomRight(image);

    expect(pixelAt(mirrored, 3, 1)).toEqual([255, 255, 255, 255]);
    expect(pixelAt(mirrored, 1, 3)).toEqual([255, 255, 255, 255]);
  });
});

function navyImage(width: number, height: number): ImageData {
  const image = new ImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      setPixel(image, x, y, [0, 0, 128, 255]);
    }
  }
  return image;
}

function setPixel(image: ImageData, x: number, y: number, rgba: [number, number, number, number]): void {
  image.data.set(rgba, (y * image.width + x) * 4);
}

function pixelAt(image: ImageData, x: number, y: number): number[] {
  return Array.from(image.data.slice((y * image.width + x) * 4, (y * image.width + x + 1) * 4));
}
