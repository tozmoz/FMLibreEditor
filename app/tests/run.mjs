import { build } from "vite";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const app = fileURLToPath(new URL("../", import.meta.url));
for (const [entry, name] of [
  ["src/rca.ts", "rca"],
  ["tests/navigation-entry.tsx", "navigation"],
]) {
  await build({
    root: app,
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
    build: {
      lib: { entry, formats: ["es"], fileName: name },
      outDir: `node_modules/.cache/feature-tests/${name}`,
      emptyOutDir: true,
    },
  });
  const result = spawnSync(process.execPath, [`tests/${name}.test.mjs`], {
    cwd: app,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
