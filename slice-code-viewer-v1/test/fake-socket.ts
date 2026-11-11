import { EventEmitter } from "node:events";
import type { Socket } from "node:net";

import type { WireMessage } from "../protocol/types.js";

export class FakeSocket extends EventEmitter {
  readonly messages: WireMessage[] = [];
  destroyed = false;

  write(data: string): boolean {
    this.messages.push(JSON.parse(data) as WireMessage);
    return true;
  }

  end(): this {
    this.destroyed = true;
    return this;
  }

  asSocket(): Socket {
    return this as unknown as Socket;
  }
}
