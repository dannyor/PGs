import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface RuntimeState {
  pid: number;
  port: number;
}

const runtimePath = join(homedir(), ".codex", "run", "code-viewer.json");

export async function readRuntimeState(): Promise<RuntimeState | undefined> {
  try {
    const value = JSON.parse(await readFile(runtimePath, "utf8")) as Partial<RuntimeState>;
    if (!Number.isInteger(value.pid) || !validPort(value.port)) return undefined;
    return value as RuntimeState;
  } catch {
    return undefined;
  }
}

export async function writeRuntimeState(port: number): Promise<void> {
  await mkdir(dirname(runtimePath), { recursive: true });
  await writeFile(runtimePath, `${JSON.stringify({ pid: process.pid, port }, null, 2)}\n`, { mode: 0o600 });
}

function validPort(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 65_535;
}
