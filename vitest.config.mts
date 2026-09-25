import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// lib/format.ts works in local time; pin the zone so results match the app's users on any machine.
process.env.TZ = "Asia/Bangkok";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    // Each DB file boots its own in-memory Postgres and runs every migration.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
