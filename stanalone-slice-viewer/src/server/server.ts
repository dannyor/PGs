import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import type { WorkspaceRegistry, WorkspaceSession } from "./workspace-registry.js";

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8"
};

export interface ViewerServerOptions {
  clientRoot: string;
  port: number;
  registry: WorkspaceRegistry;
}

export async function startViewerServer(options: ViewerServerOptions): Promise<number> {
  const server = createServer((request, response) => void routeRequest(options, request, response));
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(options.port, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Viewer server has no TCP address");
  console.log(`Codex Code Viewer: http://127.0.0.1:${address.port}`);
  return address.port;
}

async function routeRequest(
  options: ViewerServerOptions,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "POST" && url.pathname === "/api/workspaces") {
      await registerWorkspace(options, request, response);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/workspaces") {
      sendJson(response, 200, options.registry.list().map(sessionSummary));
      return;
    }
    if (url.pathname === "/") {
      const first = options.registry.list()[0];
      if (first) redirect(response, `/w/${first.id}/`);
      else sendJson(response, 404, { error: "No workspaces registered" });
      return;
    }
    if (url.pathname.startsWith("/assets/")) {
      await serveStatic(options.clientRoot, url.pathname, response);
      return;
    }

    const match = url.pathname.match(/^\/w\/([^/]+)(\/.*)?$/);
    const session = match ? options.registry.get(decodeURIComponent(match[1])) : undefined;
    if (!match || !session) {
      sendJson(response, 404, { error: "Workspace not found" });
      return;
    }
    await routeWorkspace(options.clientRoot, session, match[2] ?? "/", url, request, response);
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function registerWorkspace(
  options: ViewerServerOptions,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  if (!request.headers["content-type"]?.startsWith("application/json")) {
    sendJson(response, 415, { error: "Expected application/json" });
    return;
  }
  const body = JSON.parse(await readBody(request)) as { workspace?: unknown };
  if (typeof body.workspace !== "string" || !body.workspace) {
    sendJson(response, 400, { error: "workspace is required" });
    return;
  }
  sendJson(response, 200, sessionSummary(await options.registry.register(body.workspace)));
}

async function routeWorkspace(
  clientRoot: string,
  session: WorkspaceSession,
  path: string,
  url: URL,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }
  if (path === "/api/chunk") {
    sendJson(response, 200, { chunk: session.store.getChunk(), error: session.error });
  } else if (path.startsWith("/api/elements/")) {
    const id = decodeURIComponent(path.slice("/api/elements/".length));
    const element = session.store.getElement(id);
    sendJson(response, element ? 200 : 404, element ?? { error: "Element not found" });
  } else if (path === "/api/target") {
    await sendTarget(session, url, response);
  } else if (path === "/api/events") {
    subscribe(session, request, response);
  } else {
    await serveStatic(clientRoot, path, response);
  }
}

async function sendTarget(session: WorkspaceSession, url: URL, response: ServerResponse): Promise<void> {
  const kind = url.searchParams.get("kind");
  const symbol = url.searchParams.get("symbol");
  const path = url.searchParams.get("path");
  if (!isTargetKind(kind) || !symbol || !path) {
    sendJson(response, 400, { error: "Invalid target" });
    return;
  }
  sendJson(response, 200, await session.store.loadTarget({ kind, symbol, path }));
}

function subscribe(session: WorkspaceSession, request: IncomingMessage, response: ServerResponse): void {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  response.write("event: ready\ndata: {}\n\n");
  session.clients.add(response);
  request.on("close", () => session.clients.delete(response));
}

function sessionSummary(session: WorkspaceSession): { id: string; workspace: string; url: string } {
  return { id: session.id, workspace: session.workspace, url: `/w/${session.id}/` };
}

function isTargetKind(kind: string | null): kind is "class" | "struct" | "enum" | "function" | "field" {
  return kind === "class" || kind === "struct" || kind === "enum" || kind === "function" || kind === "field";
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 16_384) throw new Error("Request body too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function redirect(response: ServerResponse, location: string): void {
  response.writeHead(302, { Location: location });
  response.end();
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function serveStatic(clientRoot: string, requestPath: string, response: ServerResponse): Promise<void> {
  const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
  const root = resolve(clientRoot);
  let filePath = resolve(root, relativePath);
  const remainder = relative(root, filePath);
  if (isAbsolute(remainder) || remainder.startsWith("..")) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = join(filePath, "index.html");
    response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream" });
    createReadStream(filePath).pipe(response);
  } catch {
    const index = await readFile(join(clientRoot, "index.html"));
    response.writeHead(200, { "Content-Type": contentTypes[".html"] });
    response.end(index);
  }
}
