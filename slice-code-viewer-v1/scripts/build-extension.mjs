import { build } from "esbuild";

await build({
  entryPoints: ["extension/extension.ts"],
  outfile: "dist/extension/extension.cjs",
  bundle: true,
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node22",
  sourcemap: true
});
