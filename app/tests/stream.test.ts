import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileStream } from "../src/lib/replay/stream";

test("range streaming preserves bytes and survives cancellation during pending reads", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "replay-stream-"));
  const file = path.join(directory, "video.mp4"), bytes = Buffer.alloc(1024 * 1024);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
  await writeFile(file, bytes);
  try {
    const range = await fileStream(file, 129, 90000);
    const result = new Uint8Array(await new Response(range).arrayBuffer());
    assert.deepEqual(Buffer.from(result), bytes.subarray(129, 90001));
    for (let i = 0; i < 30; i++) {
      const stream = await fileStream(file, i * 13, bytes.length - 1), reader = stream.getReader();
      const pending = reader.read();
      await reader.cancel(); await pending;
      assert.equal((await reader.read()).done, true);
    }
    const reopened = await fileStream(file, bytes.length - 100, bytes.length - 1);
    assert.deepEqual(Buffer.from(await new Response(reopened).arrayBuffer()), bytes.subarray(-100));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
