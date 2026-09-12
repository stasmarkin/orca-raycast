import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@raycast/api": fileURLToPath(new URL("./test/raycast-api-mock.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["./test/temp-home.ts"],
  },
});
