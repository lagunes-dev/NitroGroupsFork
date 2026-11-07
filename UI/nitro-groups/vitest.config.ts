import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    test: {
        // Pure logic runs in node; component tests opt into jsdom with a per-file
        // `// @vitest-environment jsdom` pragma and the .test.tsx extension.
        environment: "node",
        include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
        setupFiles: ["src/test/setup.dom.ts"],
    },
});
