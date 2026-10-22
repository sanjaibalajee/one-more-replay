import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { reportFixture } from "./fixtures/report";
import { isFrameFile } from "../src/lib/replay/media-files";
import type { Reel } from "../src/lib/replay/types";

const directory = mkdtempSync(path.join(tmpdir(), "replay-evidence-images-"));
process.env.REPLAY_DATA_DIR = directory;
const store = await import("../src/lib/replay/store");
const { mediaDir } = await import("../src/lib/replay/paths");
const { sourceImages } = await import("../src/lib/replay/attachments");
const { GET } = await import("../src/app/api/replay/media/[id]/[file]/route");
after(() => {
  store.db().close();
  rmSync(directory, { recursive: true, force: true });
});

test("saved v2/v3 frames are attached to follow-up model work and served without losing legacy evidence", async () => {
  const account = store.addAccount("image_contract_fixture");
  const files = ["frame-00.jpg", "frame-v2-6-21.jpg", "frame-v3-11-90.jpg"];
  const reel = {
    id: "image-contract",
    accountId: account.id,
    analysis: {
      ...reportFixture(),
      sources: files.map((file, i) => ({
        id: `F${i + 1}`,
        kind: "frame" as const,
        file,
        label: `Frame ${i + 1}`,
        text: "Synthetic frame",
        seconds: i * 5,
      })),
    },
  } as Reel;
  store.saveReel(reel);
  files.forEach((file) =>
    writeFileSync(
      path.join(mediaDir(reel.id), file),
      `Synthetic bytes for ${file}`,
    ),
  );
  const supplied = sourceImages([reel]);
  assert.equal(supplied.files.length, 3);
  assert.deepEqual(
    supplied.index.map((source) => source.sourceId),
    ["F1", "F2", "F3"],
  );
  assert.deepEqual(
    sourceImages([reel], 2).index.map((source) => source.sourceId),
    ["F1", "F3"],
  );
  for (const file of files) {
    const response = await GET(
      new Request(`http://127.0.0.1:3210/api/replay/media/${reel.id}/${file}`),
      { params: Promise.resolve({ id: reel.id, file }) },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "image/jpeg");
    assert.equal(await response.text(), `Synthetic bytes for ${file}`);
  }
});

test("unsafe filenames cannot be attached or served as evidence", async () => {
  for (const file of [
    "../evidence.json",
    "video.mp4",
    "frame-v3-0-00.jpg/../../settings",
    "frame-v3-preview-0.jpg",
    "frame-00.jpg.exe",
    "frame-v99-0-00.jpg",
  ])
    assert.equal(isFrameFile(file), false);
  const response = await GET(
    new Request(
      "http://127.0.0.1:3210/api/replay/media/image-contract/evidence.json",
    ),
    {
      params: Promise.resolve({ id: "image-contract", file: "evidence.json" }),
    },
  );
  assert.equal(response.status, 404);
});
