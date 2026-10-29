import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    setupFiles: ["./tests/setup.js"],
    // Todos los archivos comparten la misma base remota (pedagogia-test): se ejecutan uno a uno para evitar carreras.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
