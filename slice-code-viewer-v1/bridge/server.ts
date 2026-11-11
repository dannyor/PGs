#!/usr/bin/env node
import { chmod, mkdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname } from "node:path";

import { BridgeRouter } from "./router.js";
import { defaultSocketPath } from "./socket-path.js";
import { readMessages } from "./wire.js";

const socketPath = defaultSocketPath();
const router = new BridgeRouter();

await mkdir(dirname(socketPath), { recursive: true, mode: 0o700 });
await chmod(dirname(socketPath), 0o700);
await rm(socketPath, { force: true });
const server = createServer((socket) => {
  readMessages(socket, (message) => router.handle(socket, message));
  socket.on("close", () => router.disconnect(socket));
  socket.on("error", () => router.disconnect(socket));
});

server.listen(socketPath, async () => {
  await chmod(socketPath, 0o600);
  process.stdout.write(`${socketPath}\n`);
});

function shutdown(): void {
  server.close(() => {
    void rm(socketPath, { force: true }).finally(() => process.exit(0));
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
