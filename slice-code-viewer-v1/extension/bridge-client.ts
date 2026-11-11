import { connect, type Socket } from "node:net";

import { defaultSocketPath } from "../bridge/socket-path.js";
import { readMessages, sendMessage } from "../bridge/wire.js";
import { schemaVersion, type RpcRequest, type RpcResponse } from "../protocol/types.js";

export class ExtensionBridgeClient {
  private socket: Socket | undefined;
  private stopped = false;
  private reconnectTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly workspaceId: string,
    private readonly connectionId: string,
    private readonly handleRequest: (request: RpcRequest) => Promise<RpcResponse>,
    private readonly log: (message: string) => void
  ) {}

  start(): void {
    this.connect();
  }

  dispose(): void {
    this.stopped = true;
    if (this.reconnectTimer !== undefined) clearTimeout(this.reconnectTimer);
    this.socket?.destroy();
  }

  private connect(): void {
    if (this.stopped) return;
    const socket = connect(defaultSocketPath());
    this.socket = socket;
    socket.on("connect", () => {
      this.log("connected to local bridge");
      sendMessage(socket, {
        kind: "register",
        role: "extension",
        workspaceId: this.workspaceId,
        connectionId: this.connectionId,
        schemaVersion
      });
    });
    readMessages(socket, (message) => {
      if (message.kind !== "request") return;
      void this.handleRequest(message).then((response) => sendMessage(socket, response));
    });
    socket.on("error", (error) => this.log(`bridge unavailable: ${error.message}`));
    socket.on("close", () => {
      if (this.socket === socket) this.socket = undefined;
      if (!this.stopped) this.reconnectTimer = setTimeout(() => this.connect(), 1000);
    });
  }
}
