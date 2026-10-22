import type { NextConfig } from "next";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// Load .env from parent directory
config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

const nextConfig: NextConfig = {
  distDir: process.env.REPLAY_NEXT_DIR || ".next",
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingRoot: fileURLToPath(new URL("..", import.meta.url)),
  turbopack: { root: fileURLToPath(new URL("..", import.meta.url)) },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "scontent.cdninstagram.com" },
    ],
  },
};

export default nextConfig;
