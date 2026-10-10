import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: "../../.env", quiet: true });

export default defineConfig({
  test: { fileParallelism: false, testTimeout: 20_000, hookTimeout: 60_000 },
});
