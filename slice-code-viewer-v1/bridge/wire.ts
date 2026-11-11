import type { Socket } from "node:net";

import type { WireMessage } from "../protocol/types.js";

export function sendMessage(socket: Socket, message: WireMessage): void {
  socket.write(`${JSON.stringify(message)}\n`);
}

export function readMessages(socket: Socket, onMessage: (message: WireMessage) => void): void {
  let buffered = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk: string) => {
    buffered += chunk;
    for (;;) {
      const newline = buffered.indexOf("\n");
      if (newline < 0) break;
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      if (line.trim() !== "") onMessage(JSON.parse(line) as WireMessage);
    }
  });
}
