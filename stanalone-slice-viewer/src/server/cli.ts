#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readRuntimeState, writeRuntimeState } from "./runtime-state.js";
import { startViewerServer } from "./server.js";
import { WorkspaceRegistry } from "./workspace-registry.js";

const argument = process.argv[2];
if (argument === "--help" || argument === "-h") {
  console.log("Usage: codex-code-viewer [workspace]");
  process.exit(0);
}
const workspace = resolve(argument ?? process.cwd());
const configuredPort = parsePort(process.env.CODEX_CODE_VIEWER_PORT);
const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(moduleDirectory, "../../..");
const schema = JSON.parse(await readFile(join(projectRoot, "chunk.schema.json"), "utf8")) as object;
const runtime = await readRuntimeState();
const candidatePorts = uniquePorts([configuredPort, runtime?.port, 4319]);
const existingUrl = await registerWithAnyServer(workspace, candidatePorts);
if (existingUrl) {
  console.log(existingUrl);
  process.exit(0);
}

const registry = new WorkspaceRegistry(schema);
const session = await registry.register(workspace);
const port = await startWithFallback(join(projectRoot, "dist/client"), registry, configuredPort);
await writeRuntimeState(port);
console.log(`Workspace: http://127.0.0.1:${port}/w/${session.id}/`);

async function registerWithAnyServer(workspacePath: string, ports: number[]): Promise<string | undefined> {
  for (const port of ports) {
    const url = await registerWithRunningServer(workspacePath, port);
    if (url) return url;
  }
  return undefined;
}

async function registerWithRunningServer(workspacePath: string, serverPort: number): Promise<string | undefined> {
  try {
    const response = await fetch(`http://127.0.0.1:${serverPort}/api/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: workspacePath }),
      signal: AbortSignal.timeout(2_500)
    });
    if (!response.ok) return undefined;
    const registration = await response.json() as { url: string };
    return `http://127.0.0.1:${serverPort}${registration.url}`;
  } catch {
    return undefined;
  }
}

async function startWithFallback(
  clientRoot: string,
  registry: WorkspaceRegistry,
  configuredPort: number | undefined
): Promise<number> {
  try {
    return await startViewerServer({ clientRoot, port: configuredPort ?? 4319, registry });
  } catch (error) {
    if (configuredPort || (error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    return startViewerServer({ clientRoot, port: 0, registry });
  }
}

function uniquePorts(values: Array<number | undefined>): number[] {
  return [...new Set(values.filter((value): value is number => value !== undefined))];
}

function parsePort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid CODEX_CODE_VIEWER_PORT: ${value}`);
  }
  return port;
}
