import assert from "node:assert/strict";
import test from "node:test";

import { BoundaryError, handleBoundaryRequest, type EditorBoundary } from "../extension/editor-boundary.js";

function boundaryThatRejects(code: "missing-file" | "invalid-location"): EditorBoundary {
  return {
    snapshot: async () => ({ visibleEditors: [] }),
    reveal: async () => { throw new BoundaryError(code, `reveal failed: ${code}`); }
  };
}

test("coverage for 1.4: malformed coordinates are rejected before editor navigation", async () => {
  let revealAttempted = false;
  const editor: EditorBoundary = {
    snapshot: async () => ({ visibleEditors: [] }),
    reveal: async () => { revealAttempted = true; }
  };
  const response = await handleBoundaryRequest(
    {
      kind: "request",
      id: "malformed",
      workspaceId: "/workspace",
      method: "editor.reveal",
      params: { path: "README.md", line: 0, column: 1 }
    },
    { workspaceId: "/workspace", connectionId: "connection-1", eventSequence: () => 0, editor }
  );

  assert.equal(revealAttempted, false);
  assert.deepEqual(response, {
    kind: "response",
    id: "malformed",
    error: { code: "invalid-location", message: "location must use positive one-based coordinates" }
  });
});

for (const code of ["missing-file", "invalid-location"] as const) {
  test(`coverage for 1.4: ${code} remains a distinct reveal failure`, async () => {
    const response = await handleBoundaryRequest(
      {
        kind: "request",
        id: code,
        workspaceId: "/workspace",
        method: "editor.reveal",
        params: { path: "README.md", line: 999, column: 1 }
      },
      {
        workspaceId: "/workspace",
        connectionId: "connection-1",
        eventSequence: () => 0,
        editor: boundaryThatRejects(code)
      }
    );

    assert.deepEqual(response, {
      kind: "response",
      id: code,
      error: { code, message: `reveal failed: ${code}` }
    });
  });
}
