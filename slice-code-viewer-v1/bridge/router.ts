import type { Socket } from "node:net";

import { schemaVersion, type RpcRequest, type RpcResponse, type WireMessage } from "../protocol/types.js";
import { sendMessage } from "./wire.js";

interface ExtensionConnection {
  socket: Socket;
  connectionId: string;
}

interface PendingRequest {
  client: Socket;
  extension: Socket;
}

export class BridgeRouter {
  private readonly extensions = new Map<string, ExtensionConnection>();
  private readonly pending = new Map<string, PendingRequest>();
  private readonly completed = new Map<string, RpcResponse>();

  handle(socket: Socket, message: WireMessage): void {
    if (message.kind === "register" && message.role === "extension") {
      if (message.schemaVersion !== schemaVersion) {
        socket.destroy(new Error("incompatible extension schema"));
        return;
      }
      const previous = this.extensions.get(message.workspaceId);
      if (previous !== undefined && previous.socket !== socket) previous.socket.end();
      this.extensions.set(message.workspaceId, { socket, connectionId: message.connectionId });
      return;
    }
    if (message.kind === "request") {
      this.forwardRequest(socket, message);
      return;
    }
    if (message.kind === "response") this.forwardResponse(socket, message);
  }

  disconnect(socket: Socket): void {
    for (const [workspaceId, extension] of this.extensions) {
      if (extension.socket === socket) this.extensions.delete(workspaceId);
    }
    for (const [requestId, request] of this.pending) {
      if (request.extension === socket) {
        sendMessage(request.client, {
          kind: "response",
          id: requestId,
          error: { code: "stale-connection", message: "extension disconnected before responding" }
        });
        this.pending.delete(requestId);
      } else if (request.client === socket) {
        this.pending.delete(requestId);
      }
    }
  }

  private forwardRequest(client: Socket, request: RpcRequest): void {
    const completed = this.completed.get(request.id);
    if (completed !== undefined) {
      sendMessage(client, completed);
      return;
    }
    const extension = this.extensions.get(request.workspaceId);
    if (extension === undefined || extension.socket.destroyed) {
      sendMessage(client, {
        kind: "response",
        id: request.id,
        error: { code: "extension-unavailable", message: `no extension is connected for ${request.workspaceId}` }
      });
      return;
    }
    if (this.pending.has(request.id)) {
      sendMessage(client, {
        kind: "response",
        id: request.id,
        error: { code: "invalid-request", message: `request id ${request.id} is already pending` }
      });
      return;
    }
    this.pending.set(request.id, { client, extension: extension.socket });
    sendMessage(extension.socket, request);
  }

  private forwardResponse(extension: Socket, response: RpcResponse): void {
    const pending = this.pending.get(response.id);
    if (pending === undefined || pending.extension !== extension) return;
    this.pending.delete(response.id);
    this.completed.set(response.id, response);
    if (this.completed.size > 1000) {
      const oldest = this.completed.keys().next().value as string | undefined;
      if (oldest !== undefined) this.completed.delete(oldest);
    }
    sendMessage(pending.client, response);
  }
}
