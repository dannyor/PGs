import assert from "node:assert/strict";
import test from "node:test";

import { BridgeRouter } from "../bridge/router.js";
import { schemaVersion } from "../protocol/types.js";
import { FakeSocket } from "./fake-socket.js";

test("coverage: a request reaches the extension registered for its workspace", () => {
  const router = new BridgeRouter();
  const extension = new FakeSocket();
  const client = new FakeSocket();
  router.handle(extension.asSocket(), {
    kind: "register", role: "extension", workspaceId: "/workspace", connectionId: "connection-1", schemaVersion
  });

  router.handle(client.asSocket(), { kind: "request", id: "request-1", workspaceId: "/workspace", method: "workspace.snapshot" });
  router.handle(extension.asSocket(), { kind: "response", id: "request-1", result: { workspaceId: "/workspace" } });

  assert.equal(extension.messages[0]?.kind, "request");
  assert.deepEqual(client.messages[0], { kind: "response", id: "request-1", result: { workspaceId: "/workspace" } });
});

test("repeating a completed request id returns its response without repeating the extension action", () => {
  const router = new BridgeRouter();
  const extension = new FakeSocket();
  const client = new FakeSocket();
  const request = { kind: "request" as const, id: "request-1", workspaceId: "/workspace", method: "review.load" };
  router.handle(extension.asSocket(), {
    kind: "register", role: "extension", workspaceId: "/workspace", connectionId: "connection-1", schemaVersion
  });
  router.handle(client.asSocket(), request);
  router.handle(extension.asSocket(), { kind: "response", id: "request-1", result: { reviewId: "slice-1" } });

  router.handle(client.asSocket(), request);

  assert.equal(extension.messages.length, 1);
  assert.equal(client.messages.length, 2);
  assert.deepEqual(client.messages[1], client.messages[0]);
});
