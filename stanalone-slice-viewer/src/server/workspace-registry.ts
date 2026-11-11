import { createHash } from "node:crypto";
import { mkdir, stat } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { basename, dirname, join, resolve } from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { ChunkStore } from "./chunk-store.js";

export class WorkspaceSession {
  readonly clients = new Set<ServerResponse>();
  readonly descriptorPath: string;
  readonly store: ChunkStore;
  error?: string;
  #watcher?: FSWatcher;

  constructor(readonly id: string, readonly workspace: string, schema: object) {
    this.descriptorPath = join(workspace, ".codex/code-viewer/chunk.json");
    this.store = new ChunkStore(workspace, schema);
  }

  async start(): Promise<void> {
    await mkdir(dirname(this.descriptorPath), { recursive: true });
    await this.reloadIfPresent();
    this.#watcher = chokidar.watch(this.descriptorPath, { ignoreInitial: true });
    this.#watcher.on("add", () => void this.reload()).on("change", () => void this.reload());
  }

  async reload(): Promise<void> {
    try {
      await this.store.load(this.descriptorPath);
      this.error = undefined;
      this.broadcast("chunk");
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.broadcast("error");
      console.error(`[${this.id}] Descriptor load failed: ${this.error}`);
    }
  }

  private async reloadIfPresent(): Promise<void> {
    try {
      await stat(this.descriptorPath);
      await this.reload();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private broadcast(event: string): void {
    for (const client of this.clients) client.write(`event: ${event}\ndata: {}\n\n`);
  }
}

export class WorkspaceRegistry {
  readonly #sessions = new Map<string, WorkspaceSession>();
  readonly #workspaceIds = new Map<string, string>();
  readonly #pending = new Map<string, Promise<WorkspaceSession>>();

  constructor(readonly schema: object) {}

  async register(workspacePath: string): Promise<WorkspaceSession> {
    const workspace = resolve(workspacePath);
    const existingId = this.#workspaceIds.get(workspace);
    if (existingId) return this.#sessions.get(existingId)!;
    const pending = this.#pending.get(workspace);
    if (pending) return pending;

    const registration = this.createSession(workspace).finally(() => this.#pending.delete(workspace));
    this.#pending.set(workspace, registration);
    return registration;
  }

  get(id: string): WorkspaceSession | undefined {
    return this.#sessions.get(id);
  }

  list(): WorkspaceSession[] {
    return [...this.#sessions.values()];
  }

  private async createSession(workspace: string): Promise<WorkspaceSession> {
    if (!(await stat(workspace)).isDirectory()) throw new Error(`Workspace is not a directory: ${workspace}`);
    const id = workspaceId(workspace);
    const session = new WorkspaceSession(id, workspace, this.schema);
    await session.start();
    this.#sessions.set(id, session);
    this.#workspaceIds.set(workspace, id);
    return session;
  }
}

function workspaceId(workspace: string): string {
  const name = basename(workspace).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "workspace";
  const digest = createHash("sha256").update(workspace).digest("hex").slice(0, 8);
  return `${name}-${digest}`;
}
