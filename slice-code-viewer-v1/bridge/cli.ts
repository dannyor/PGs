#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { connect } from "node:net";
import { randomUUID } from "node:crypto";

import type { RpcRequest, RpcResponse } from "../protocol/types.js";
import { defaultSocketPath } from "./socket-path.js";
import { readMessages, sendMessage } from "./wire.js";

function usage(): never {
  throw new Error("usage: codex-code-server <workspace-id> <snapshot|reveal|review-load|review-events> [arguments]");
}

const [, , workspaceId, command, ...args] = process.argv;
if (workspaceId === undefined || command === undefined) usage();

async function requestForCommand(): Promise<RpcRequest> {
  const base = { kind: "request" as const, id: randomUUID(), workspaceId };
  if (command === "snapshot") return { ...base, method: "workspace.snapshot" };
  if (command === "reveal") {
    const [path, line = "1", column = "1"] = args;
    if (path === undefined) usage();
    return { ...base, method: "editor.reveal", params: { path, line: Number(line), column: Number(column) } };
  }
  if (command === "review-load") {
    const [descriptorPath] = args;
    if (descriptorPath === undefined) usage();
    return { ...base, method: "review.load", params: JSON.parse(await readFile(descriptorPath, "utf8")) as unknown };
  }
  if (command === "review-events") {
    return { ...base, method: "review.events", params: { afterSequence: Number(args[0] ?? 0) } };
  }
  return usage();
}

const request = await requestForCommand();
const socket = connect(defaultSocketPath());
socket.on("connect", () => {
  sendMessage(socket, { kind: "register", role: "client" });
  sendMessage(socket, request);
});
readMessages(socket, (message) => {
  if (message.kind !== "response" || message.id !== request.id) return;
  process.stdout.write(`${JSON.stringify(message as RpcResponse, null, 2)}\n`);
  socket.end();
  process.exitCode = "error" in message ? 1 : 0;
});
socket.on("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
