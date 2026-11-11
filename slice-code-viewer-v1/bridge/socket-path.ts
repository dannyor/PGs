import { join } from "node:path";
import { tmpdir } from "node:os";

export function defaultSocketPath(): string {
  return process.env.CODEX_CODE_SERVER_SOCKET
    ?? join(tmpdir(), `codex-code-server-${process.getuid?.() ?? "user"}`, "bridge.sock");
}
