import { compressImage } from '@/lib/utils/compressImage';

type CanvasArgs = { width: number; height: number };

const canvasConstructions: CanvasArgs[] = [];
let contextValue: unknown = {};
let convertedBlob: Blob = new Blob(['x'], { type: 'image/jpeg' });

class FakeOffscreenCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    canvasConstructions.push({ width, height });
  }
  getContext() {
    return contextValue;
  }
  convertToBlob() {
    return Promise.resolve(convertedBlob);
  }
}

function fakeBitmap(width: number, height: number) {
  return { width, height, close: jest.fn() };
}

describe('compressImage', () => {
  beforeEach(() => {
    canvasConstructions.length = 0;
    contextValue = { drawImage: jest.fn() };
    convertedBlob = new Blob(['compressed'], { type: 'image/jpeg' });
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-04T00:00:00Z'));
    (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas =
      FakeOffscreenCanvas;
    (globalThis as unknown as { createImageBitmap: unknown }).createImageBitmap =
      jest.fn(() => Promise.resolve(fakeBitmap(800, 600)));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('returns the original file when the type is not an image', async () => {
    const pdf = new File(['data'], 'doc.pdf', { type: 'application/pdf' });

    const result = await compressImage(pdf);

    expect(result).toBe(pdf);
  });

  it('outputs a jpeg file renamed with a .jpg extension', async () => {
    const photo = new File(['raw'], 'vacation.png', { type: 'image/png' });

    const result = await compressImage(photo);

    expect(result.name).toBe('vacation.jpg');
    expect(result.type).toBe('image/jpeg');
  });

  it('downscales the canvas when the longest side exceeds the max dimension', async () => {
    (globalThis as unknown as { createImageBitmap: unknown }).createImageBitmap =
      jest.fn(() => Promise.resolve(fakeBitmap(3200, 1600)));
    const photo = new File(['raw'], 'wide.jpg', { type: 'image/jpeg' });

    await compressImage(photo, { maxDimension: 1600, quality: 0.8 });

    expect(canvasConstructions[0]).toEqual({ width: 1600, height: 800 });
  });

  it('keeps original dimensions when the image is smaller than the max dimension', async () => {
    const photo = new File(['raw'], 'small.jpg', { type: 'image/jpeg' });

    await compressImage(photo, { maxDimension: 1600 });

    expect(canvasConstructions[0]).toEqual({ width: 800, height: 600 });
  });

  it('returns the original file when a 2d context is unavailable', async () => {
    contextValue = null;
    const photo = new File(['raw'], 'nocontext.png', { type: 'image/png' });

    const result = await compressImage(photo);

    expect(result).toBe(photo);
  });
});
