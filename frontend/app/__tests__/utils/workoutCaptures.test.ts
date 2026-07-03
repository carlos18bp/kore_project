import { scheduleCaptureOffsets, createUploadQueue, type CaptureItem } from '@/lib/utils/workoutCaptures';

describe('scheduleCaptureOffsets', () => {
  it('returns sorted offsets inside the window using the provided rng', () => {
    const seq = [0.1, 0.9, 0.5];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const offsets = scheduleCaptureOffsets(3, 60_000, rng);
    expect(offsets).toHaveLength(3);
    expect([...offsets]).toEqual([...offsets].sort((a, b) => a - b));
    for (const o of offsets) {
      expect(o).toBeGreaterThanOrEqual(3000);
      expect(o).toBeLessThanOrEqual(59_000);
    }
  });

  it('clamps tiny windows to a single early offset range', () => {
    const offsets = scheduleCaptureOffsets(2, 5000, () => 0.5);
    for (const o of offsets) {
      expect(o).toBeGreaterThanOrEqual(1000);
      expect(o).toBeLessThanOrEqual(4000);
    }
  });
});

describe('createUploadQueue', () => {
  const item = (n: number): CaptureItem => ({ logId: 1, exLogId: n, file: new File(['x'], `${n}.jpg`) });

  it('uploads sequentially and retries a failure once', async () => {
    const calls: number[] = [];
    let failedOnce = false;
    const uploader = jest.fn(async (it: CaptureItem) => {
      calls.push(it.exLogId);
      if (it.exLogId === 2 && !failedOnce) { failedOnce = true; return false; }
      return true;
    });
    const q = createUploadQueue(uploader);
    q.enqueue(item(1));
    q.enqueue(item(2));
    q.enqueue(item(3));
    await q.flush();
    expect(calls).toEqual([1, 2, 2, 3]); // 2 retried once
    expect(q.pendingCount()).toBe(0);
  });

  it('drops an item after the retry also fails', async () => {
    const uploader = jest.fn(async () => false);
    const q = createUploadQueue(uploader);
    q.enqueue(item(9));
    await q.flush();
    expect(uploader).toHaveBeenCalledTimes(2);
    expect(q.pendingCount()).toBe(0);
  });
});
