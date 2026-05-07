#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const resourcesDir = resolve(root, "apps/desktopapp/src-tauri/resources");
const manifestPath = resolve(resourcesDir, "pulse-service-bundle.json");

const requiredFiles = [
  "pulse-api/server.mjs",
  "pulse-analyzer/src/vaexcore_pulse_analyzer/__init__.py",
  "pulse-analyzer/src/vaexcore_pulse_analyzer/server.py",
  "pulse-analyzer/src/vaexcore_pulse_analyzer/service.py",
  "pulse-analyzer/src/vaexcore_pulse_analyzer/pipeline/orchestrator.py",
  "pulse-analyzer/src/vaexcore_pulse_analyzer/storage/session_store.py",
];

const errors = [];

if (!existsSync(manifestPath)) {
  errors.push(`missing service bundle manifest: ${manifestPath}`);
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.schemaVersion !== 1) {
    errors.push("pulse-service-bundle.json schemaVersion must be 1");
  }
  if (manifest.apiEntrypoint !== "pulse-api/server.mjs") {
    errors.push(
      "pulse-service-bundle.json apiEntrypoint must be pulse-api/server.mjs",
    );
  }
  if (manifest.analyzerSource !== "pulse-analyzer/src") {
    errors.push(
      "pulse-service-bundle.json analyzerSource must be pulse-analyzer/src",
    );
  }
}

for (const file of requiredFiles) {
  const path = resolve(resourcesDir, file);
  if (!existsSync(path)) {
    errors.push(`missing bundled helper resource: ${file}`);
    continue;
  }
  if (statSync(path).size === 0) {
    errors.push(`bundled helper resource is empty: ${file}`);
  }
}

const apiBundlePath = resolve(resourcesDir, "pulse-api/server.mjs");
if (existsSync(apiBundlePath)) {
  const apiBundle = readFileSync(apiBundlePath, "utf8");
  for (const workspaceImport of [
    "@vaexcore/pulse-domain",
    "@vaexcore/pulse-profiles",
    "@vaexcore/pulse-shared-types",
  ]) {
    if (apiBundle.includes(workspaceImport)) {
      errors.push(
        `API bundle still contains workspace import ${workspaceImport}`,
      );
    }
  }
  const runtimeError = await smokeApiBundle(apiBundlePath);
  if (runtimeError) {
    errors.push(runtimeError);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Pulse service bundle resources are complete.");

async function smokeApiBundle(apiBundlePath) {
  const homeDir = mkdtempSync(resolve(tmpdir(), "vaexcore-pulse-api-bundle-"));
  let settled = false;
  let output = "";
  const child = spawn(process.execPath, [apiBundlePath], {
    env: {
      ...process.env,
      HOME: homeDir,
      VAEXCORE_PULSE_API_HOST: "127.0.0.1",
      VAEXCORE_PULSE_API_PORT: "0",
      VAEXCORE_PULSE_ANALYZER_URL: "http://127.0.0.1:1",
      VAEXCORE_PULSE_ANALYZER_TIMEOUT_MS: "50",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const result = await new Promise((resolveSmoke) => {
    const finish = (message) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolveSmoke(message);
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(null);
    }, 1_500);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) =>
      finish(`API bundle could not start: ${error.message}`),
    );
    child.on("exit", (code, signal) => {
      if (settled) {
        return;
      }
      finish(
        `API bundle exited during startup smoke (code ${code}, signal ${signal ?? "none"}): ${output.trim()}`,
      );
    });
  });

  rmSync(homeDir, { recursive: true, force: true });
  return result;
}
