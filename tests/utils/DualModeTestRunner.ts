import { expect, Page, TestInfo } from '@playwright/test';
import {
  drawOnCanvas,
  expectRenderingBackend,
  getWhitePixelCount,
  RenderingBackend,
} from './canvasHelpers';

interface WhitePixelMask {
  width: number;
  height: number;
  bits: string;
  whitePixels: number;
}

export interface BackendParityResult {
  canvas2d: Omit<WhitePixelMask, 'bits'>;
  webgl: Omit<WhitePixelMask, 'bits'>;
  intersectionPixels: number;
  unionPixels: number;
  differingPixels: number;
  similarity: number;
  transformedSimilarities: Record<string, number>;
}

/**
 * Runs the same user interaction in fresh app states and compares the visible
 * unfolded output. The visible output is intentionally read through Canvas 2D:
 * the production WebGL path renders to a hidden WebGL canvas and copies the
 * final image to the user-visible 2D canvas.
 */
export class DualModeTestRunner {
  constructor(
    private readonly page: Page,
    private readonly testInfo?: TestInfo
  ) {}

  async compareDrawingOutput(
    operation: () => Promise<void>,
    canvasIndex: number = 1
  ): Promise<BackendParityResult> {
    const canvas2d = await this.renderWithBackend('canvas2d', operation, canvasIndex);
    const webgl = await this.renderWithBackend('webgl', operation, canvasIndex);

    expect(webgl.width).toBe(canvas2d.width);
    expect(webgl.height).toBe(canvas2d.height);

    const canvas2dBits = Buffer.from(canvas2d.bits, 'base64');
    const webglBits = Buffer.from(webgl.bits, 'base64');
    let intersectionPixels = 0;
    let unionPixels = 0;
    let differingPixels = 0;

    for (let byteIndex = 0; byteIndex < canvas2dBits.length; byteIndex++) {
      const canvas2dByte = canvas2dBits[byteIndex];
      const webglByte = webglBits[byteIndex];
      intersectionPixels += countSetBits(canvas2dByte & webglByte);
      unionPixels += countSetBits(canvas2dByte | webglByte);
      differingPixels += countSetBits(canvas2dByte ^ webglByte);
    }

    const transformedSimilarities = Object.fromEntries(
      Object.entries(pixelTransforms).map(([name, transform]) => [
        name,
        calculateSimilarity(canvas2dBits, webglBits, canvas2d.width, canvas2d.height, transform),
      ])
    );

    return {
      canvas2d: withoutBits(canvas2d),
      webgl: withoutBits(webgl),
      intersectionPixels,
      unionPixels,
      differingPixels,
      similarity: unionPixels === 0 ? 1 : intersectionPixels / unionPixels,
      transformedSimilarities,
    };
  }

  private async renderWithBackend(
    backend: RenderingBackend,
    operation: () => Promise<void>,
    canvasIndex: number
  ): Promise<WhitePixelMask> {
    await this.page.goto('/');
    await expect(this.page.getByRole('heading', { name: 'Shibori Folding' })).toBeVisible();

    const label = backend === 'canvas2d' ? 'Canvas 2D' : 'WebGL';
    await this.page.getByRole('button', { name: label, exact: true }).click();
    const initialWhitePixels = await getWhitePixelCount(this.page, canvasIndex);
    await operation();
    await expect.poll(() => getWhitePixelCount(this.page, canvasIndex), { timeout: 10_000 })
      .toBeGreaterThan(initialWhitePixels + 200);
    await expectRenderingBackend(this.page, backend, { verifyRequestedMode: false });

    if (this.testInfo) {
      await this.testInfo.attach(`${backend}-visible-canvas`, {
        body: await this.page.locator('canvas').nth(canvasIndex).screenshot(),
        contentType: 'image/png',
      });
    }

    return this.captureWhitePixelMask(canvasIndex);
  }

  private async captureWhitePixelMask(canvasIndex: number): Promise<WhitePixelMask> {
    return this.page.evaluate((index) => {
      const canvas = document.querySelectorAll('canvas')[index] as HTMLCanvasElement | undefined;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) {
        throw new Error(`Visible canvas ${index} is unavailable`);
      }

      const pixelData = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const bitMask = new Uint8Array(Math.ceil((pixelData.length / 4) / 8));
      let whitePixels = 0;

      for (let pixelIndex = 0; pixelIndex < pixelData.length / 4; pixelIndex++) {
        const dataIndex = pixelIndex * 4;
        if (
          pixelData[dataIndex] > 240 &&
          pixelData[dataIndex + 1] > 240 &&
          pixelData[dataIndex + 2] > 240
        ) {
          bitMask[Math.floor(pixelIndex / 8)] |= 1 << (pixelIndex % 8);
          whitePixels++;
        }
      }

      let binary = '';
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bitMask.length; offset += chunkSize) {
        binary += String.fromCharCode(...bitMask.subarray(offset, offset + chunkSize));
      }

      return {
        width: canvas.width,
        height: canvas.height,
        bits: btoa(binary),
        whitePixels,
      };
    }, canvasIndex);
  }
}

export async function drawDeterministicStroke(page: Page): Promise<void> {
  await drawOnCanvas(page.locator('canvas').first(), {
    // The default diagonal fold makes the upper-left half non-drawable.
    // Keep this gesture wholly inside the lower-right drawable triangle.
    startOffset: { x: 40, y: 20 },
    endOffset: { x: 100, y: 80 },
  });
}

function countSetBits(value: number): number {
  let remaining = value;
  let count = 0;
  while (remaining !== 0) {
    remaining &= remaining - 1;
    count++;
  }
  return count;
}

function withoutBits(mask: WhitePixelMask): Omit<WhitePixelMask, 'bits'> {
  return {
    width: mask.width,
    height: mask.height,
    whitePixels: mask.whitePixels,
  };
}

type PixelTransform = (x: number, y: number, width: number, height: number) => [number, number];

const pixelTransforms: Record<string, PixelTransform> = {
  horizontalFlip: (x, y, width) => [width - 1 - x, y],
  verticalFlip: (x, y, _width, height) => [x, height - 1 - y],
  rotate180: (x, y, width, height) => [width - 1 - x, height - 1 - y],
  transpose: (x, y) => [y, x],
  rotate90: (x, y, _width, height) => [height - 1 - y, x],
  rotate270: (x, y, width) => [y, width - 1 - x],
};

function calculateSimilarity(
  expected: Buffer,
  actual: Buffer,
  width: number,
  height: number,
  transform: PixelTransform
): number {
  let intersection = 0;
  let union = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const expectedSet = isSet(expected, y * width + x);
      const [actualX, actualY] = transform(x, y, width, height);
      const actualSet = isSet(actual, actualY * width + actualX);
      if (expectedSet && actualSet) intersection++;
      if (expectedSet || actualSet) union++;
    }
  }
  return union === 0 ? 1 : intersection / union;
}

function isSet(bits: Buffer, pixelIndex: number): boolean {
  return (bits[Math.floor(pixelIndex / 8)] & (1 << (pixelIndex % 8))) !== 0;
}
