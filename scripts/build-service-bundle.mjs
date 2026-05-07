#!/usr/bin/env node
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const resourcesDir = resolve(root, "apps/desktopapp/src-tauri/resources");
const apiOutDir = resolve(resourcesDir, "pulse-api");
const analyzerOutDir = resolve(resourcesDir, "pulse-analyzer");

const aliases = new Map([
  ["@vaexcore/pulse-domain", resolve(root, "packages/domain/src/index.ts")],
  ["@vaexcore/pulse-profiles", resolve(root, "packages/profiles/src/index.ts")],
  [
    "@vaexcore/pulse-shared-types",
    resolve(root, "packages/shared-types/src/index.ts"),
  ],
  [
    "@vaexcore/pulse-shared-types/testing",
    resolve(root, "packages/shared-types/src/testing.ts"),
  ],
]);

rmSync(apiOutDir, { recursive: true, force: true });
rmSync(analyzerOutDir, { recursive: true, force: true });
mkdirSync(apiOutDir, { recursive: true });
mkdirSync(analyzerOutDir, { recursive: true });

await build({
  entryPoints: [resolve(root, "services/api/src/server.ts")],
  outfile: resolve(apiOutDir, "server.mjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: false,
  logLevel: "silent",
  plugins: [workspaceAliasPlugin()],
});

cpSync(resolve(root, "services/analyzer/src"), resolve(analyzerOutDir, "src"), {
  recursive: true,
});

writeFileSync(
  resolve(resourcesDir, "pulse-service-bundle.json"),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      apiEntrypoint: "pulse-api/server.mjs",
      analyzerSource: "pulse-analyzer/src",
    },
    null,
    2,
  )}\n`,
);

console.log(`Pulse service bundle written to ${resourcesDir}`);

function workspaceAliasPlugin() {
  return {
    name: "vaexcore-pulse-workspace-alias",
    setup(buildContext) {
      buildContext.onResolve({ filter: /^@vaexcore\/pulse-/ }, (args) => {
        const alias = aliases.get(args.path);
        if (!alias) {
          return;
        }
        return { path: alias };
      });
    },
  };
}
