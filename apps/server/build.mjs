// Bundles the server (and the TypeScript sources of @ghostel/shared) into dist/main.js.
// npm dependencies stay external and are loaded from node_modules at runtime.
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith("@ghostel/"));

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  sourcemap: true,
  external: [...external, "@fastify/*"],
  logLevel: "info",
});
