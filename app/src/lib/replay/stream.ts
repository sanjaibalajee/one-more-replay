import { open } from "node:fs/promises";

// A pull-based stream keeps backpressure and cancellation in the same lifecycle.
// Readable.toWeb can enqueue after a browser cancels a video range request.
export async function fileStream(file: string, start: number, end: number): Promise<ReadableStream<Uint8Array>> {
  const handle = await open(file, "r");
  let position = start, stopped = false, cancelled = false, closing: Promise<void> | undefined;
  const close = () => closing ||= handle.close();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (stopped) return;
      try {
        const buffer = new Uint8Array(Math.min(64 * 1024, end - position + 1));
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
        if (stopped) return;
        if (bytesRead) { position += bytesRead; controller.enqueue(buffer.subarray(0, bytesRead)); }
        if (!bytesRead || position > end) {
          stopped = true;
          await close();
          if (!cancelled) controller.close();
        }
      } catch (error) {
        if (!stopped) { stopped = true; controller.error(error); }
        await close().catch(() => {});
      }
    },
    async cancel() { cancelled = true; stopped = true; await close().catch(() => {}); },
  }, { highWaterMark: 0 });
}
