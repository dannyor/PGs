import { posix, win32 } from "node:path";

import { schemaVersion, type RpcErrorCode, type RpcRequest, type RpcResponse, type SourceLocation, type WorkspaceSnapshot } from "../protocol/types.js";

export type EditorSnapshot = Pick<WorkspaceSnapshot, "activeFile" | "selection" | "visibleEditors">;

export interface EditorBoundary {
  snapshot(): Promise<EditorSnapshot>;
  reveal(location: SourceLocation): Promise<void>;
}

export interface BoundaryContext {
  workspaceId: string;
  connectionId: string;
  eventSequence(): number;
  editor: EditorBoundary;
}

export class BoundaryError extends Error {
  constructor(readonly code: RpcErrorCode, message: string) {
    super(message);
    this.name = "BoundaryError";
  }
}

function responseError(request: RpcRequest, code: RpcErrorCode, message: string): RpcResponse {
  return { kind: "response", id: request.id, error: { code, message } };
}

function parseLocation(value: unknown): SourceLocation {
  if (typeof value !== "object" || value === null) throw new BoundaryError("invalid-location", "location parameters are required");
  const location = value as Partial<SourceLocation>;
  if (typeof location.path !== "string" || !Number.isInteger(location.line) || !Number.isInteger(location.column)) {
    throw new BoundaryError("invalid-location", "location requires path, line, and column");
  }
  const pathSegments = location.path.split(/[\\/]/);
  if (location.path.trim() === "" || posix.isAbsolute(location.path) || win32.isAbsolute(location.path) || pathSegments.includes("..")) {
    throw new BoundaryError("outside-workspace", "location must name a file inside the workspace");
  }
  if ((location.line as number) < 1 || (location.column as number) < 1) {
    throw new BoundaryError("invalid-location", "location must use positive one-based coordinates");
  }
  return location as SourceLocation;
}

export async function handleBoundaryRequest(request: RpcRequest, context: BoundaryContext): Promise<RpcResponse | undefined> {
  try {
    if (request.method === "workspace.snapshot") {
      const snapshot = await context.editor.snapshot();
      return {
        kind: "response",
        id: request.id,
        result: {
          workspaceId: context.workspaceId,
          connectionId: context.connectionId,
          schemaVersion,
          ...snapshot,
          eventSequence: context.eventSequence()
        }
      };
    }
    if (request.method === "editor.reveal") {
      await context.editor.reveal(parseLocation(request.params));
      return { kind: "response", id: request.id, result: { revealed: true } };
    }
    return undefined;
  } catch (error) {
    if (error instanceof BoundaryError) return responseError(request, error.code, error.message);
    const message = error instanceof Error ? error.message : String(error);
    return responseError(request, "internal-error", message);
  }
}
