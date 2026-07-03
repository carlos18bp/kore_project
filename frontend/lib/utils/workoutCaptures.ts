/**
 * Pure helpers for the workout camera validation flow.
 * The capture timing is intentionally unpredictable for the client:
 * offsets are random within the exercise execution window.
 */

export type CaptureItem = { logId: number; exLogId: number; file: File };

export function scheduleCaptureOffsets(
  count: number,
  windowMs: number,
  rng: () => number = Math.random,
): number[] {
  const min = windowMs >= 10_000 ? 3000 : 1000;
  const max = Math.max(min + 500, windowMs - 1000);
  const offsets = Array.from({ length: count }, () => min + rng() * (max - min));
  return offsets.map(Math.round).sort((a, b) => a - b);
}

export function createUploadQueue(uploader: (item: CaptureItem) => Promise<boolean>) {
  const queue: { item: CaptureItem; attempts: number }[] = [];
  let running: Promise<void> | null = null;

  async function pump(): Promise<void> {
    while (queue.length > 0) {
      const entry = queue[0];
      const ok = await uploader(entry.item);
      if (ok || entry.attempts >= 1) {
        queue.shift();
      } else {
        entry.attempts += 1;
      }
    }
    running = null;
  }

  return {
    enqueue(item: CaptureItem) {
      queue.push({ item, attempts: 0 });
      if (!running) running = pump();
    },
    async flush() {
      if (running) await running;
    },
    pendingCount: () => queue.length,
  };
}
