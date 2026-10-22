import { defineConfig } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: "./tests/browser", fullyParallel: false, workers: 1, timeout: 60000,
  use: { baseURL: "http://127.0.0.1:3211", browserName: "chromium", trace: "retain-on-failure" },
  webServer: { command: "npx next dev --hostname 127.0.0.1 --port 3211", url: "http://127.0.0.1:3211", reuseExistingServer: false, timeout: 120000,
    env: { REPLAY_DATA_DIR: path.resolve(`../.local/e2e-${Date.now()}`), REPLAY_NEXT_DIR: ".next-e2e", APIFY_API_TOKEN: "", OPENAI_API_KEY: "" } },
});
