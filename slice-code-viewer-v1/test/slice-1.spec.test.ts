import assert from "node:assert/strict";
import test from "node:test";

import { BridgeRouter } from "../bridge/router.js";
import { BoundaryError, handleBoundaryRequest, type EditorBoundary } from "../extension/editor-boundary.js";
import { schemaVersion, type SourceLocation } from "../protocol/types.js";
import { FakeSocket } from "./fake-socket.js";

/*
 * SPECIFICATION TESTS — SLICE 1
 *
 * These tests are the reader-first executable specification of the safe
 * Codex/editor boundary. Defensive variants belong in Slice 1 coverage tests.
 */

test("1.1 connected workspace snapshot returns the context needed to identify the editor", async () => {
  const editor: EditorBoundary = {
    snapshot: async () => ({
      activeFile: "src/router.ts",
      selection: { startLine: 12, startColumn: 3, endLine: 12, endColumn: 8 },
      visibleEditors: ["src/router.ts", "test/router.spec.ts"]
    }),
    reveal: async () => undefined
  };

  const response = await handleBoundaryRequest(
    { kind: "request", id: "request-1", workspaceId: "/workspace", method: "workspace.snapshot" },
    { workspaceId: "/workspace", connectionId: "connection-1", eventSequence: () => 7, editor }
  );

  assert.deepEqual(response, {
    kind: "response",
    id: "request-1",
    result: {
      workspaceId: "/workspace",
      connectionId: "connection-1",
      schemaVersion: 1,
      activeFile: "src/router.ts",
      selection: { startLine: 12, startColumn: 3, endLine: 12, endColumn: 8 },
      visibleEditors: ["src/router.ts", "test/router.spec.ts"],
      eventSequence: 7
    }
  });
});

test("1.2 safe source reveal requests an exact location without an editing capability", async () => {
  let revealed: SourceLocation | undefined;
  const editor: EditorBoundary = {
    snapshot: async () => ({ visibleEditors: [] }),
    reveal: async (location) => { revealed = location; }
  };

  const response = await handleBoundaryRequest(
    {
      kind: "request",
      id: "request-2",
      workspaceId: "/workspace",
      method: "editor.reveal",
      params: { path: "src/router.ts", line: 20, column: 3 }
    },
    { workspaceId: "/workspace", connectionId: "connection-1", eventSequence: () => 0, editor }
  );

  assert.deepEqual(revealed, { path: "src/router.ts", line: 20, column: 3 });
  assert.deepEqual(response, { kind: "response", id: "request-2", result: { revealed: true } });
});

test("1.3 unavailable and stale extensions return distinct actionable failures", () => {
  const router = new BridgeRouter();
  const unavailableClient = new FakeSocket();
  router.handle(unavailableClient.asSocket(), {
    kind: "request", id: "unavailable", workspaceId: "/workspace", method: "workspace.snapshot"
  });

  const extension = new FakeSocket();
  const staleClient = new FakeSocket();
  router.handle(extension.asSocket(), {
    kind: "register", role: "extension", workspaceId: "/workspace", connectionId: "connection-1", schemaVersion
  });
  router.handle(staleClient.asSocket(), {
    kind: "request", id: "stale", workspaceId: "/workspace", method: "workspace.snapshot"
  });
  router.disconnect(extension.asSocket());

  assert.deepEqual(unavailableClient.messages[0], {
    kind: "response",
    id: "unavailable",
    error: { code: "extension-unavailable", message: "no extension is connected for /workspace" }
  });
  assert.deepEqual(staleClient.messages[0], {
    kind: "response",
    id: "stale",
    error: { code: "stale-connection", message: "extension disconnected before responding" }
  });
});

test("1.4 workspace boundary rejection returns an explicit error without revealing a file", async () => {
  let revealAttempted = false;
  const editor: EditorBoundary = {
    snapshot: async () => ({ visibleEditors: [] }),
    reveal: async () => {
      revealAttempted = true;
      throw new BoundaryError("outside-workspace", "location must name a file inside the workspace");
    }
  };

  const response = await handleBoundaryRequest(
    {
      kind: "request",
      id: "request-4",
      workspaceId: "/workspace",
      method: "editor.reveal",
      params: { path: "../secret", line: 1, column: 1 }
    },
    { workspaceId: "/workspace", connectionId: "connection-1", eventSequence: () => 0, editor }
  );

  assert.equal(revealAttempted, false);
  assert.deepEqual(response, {
    kind: "response",
    id: "request-4",
    error: { code: "outside-workspace", message: "location must name a file inside the workspace" }
  });
});
