export const schemaVersion = 1 as const;

export type ReviewItemKind = "specification" | "implementation" | "boundary" | "context";
export type ReviewCodeRole = "main" | "test";
export type ReviewItemStatus = "unviewed" | "understood" | "skipped";

export interface SourceLocation {
  path: string;
  line: number;
  column: number;
}

export interface SliceScenario {
  id: string;
  title: string;
  behavior: string;
}

export interface ReviewItem {
  id: string;
  title: string;
  kind: ReviewItemKind;
  codeRole: ReviewCodeRole;
  /** The primary AI-declared claim the human reviews against code and evidence. */
  intent: string;
  scenarioIds: string[];
  location: SourceLocation;
}

export interface ReviewDescriptor {
  schemaVersion: typeof schemaVersion;
  id: string;
  title: string;
  promise: string;
  workspaceId: string;
  scenarios: SliceScenario[];
  items: ReviewItem[];
}

export interface ReviewQuestion {
  itemId: string;
  text: string;
  sequence: number;
}

export interface ReviewProgress {
  descriptor: ReviewDescriptor;
  currentItemId?: string;
  itemStatuses: Record<string, ReviewItemStatus>;
  questions: ReviewQuestion[];
  events: ReviewEvent[];
  nextSequence: number;
}

export type ReviewEvent =
  | { sequence: number; type: "intent-understood"; itemId: string }
  | { sequence: number; type: "item-skipped"; itemId: string }
  | { sequence: number; type: "question-asked"; itemId: string; text: string };

export interface WorkspaceSnapshot {
  workspaceId: string;
  connectionId: string;
  schemaVersion: typeof schemaVersion;
  activeFile?: string;
  selection?: { startLine: number; startColumn: number; endLine: number; endColumn: number };
  visibleEditors: string[];
  eventSequence: number;
}

export type RpcErrorCode =
  | "extension-unavailable"
  | "stale-connection"
  | "invalid-request"
  | "invalid-descriptor"
  | "outside-workspace"
  | "missing-file"
  | "invalid-location"
  | "incompatible-schema"
  | "internal-error";

export interface RpcRequest {
  kind: "request";
  id: string;
  workspaceId: string;
  method: string;
  params?: unknown;
}

export type RpcResponse =
  | { kind: "response"; id: string; result: unknown }
  | { kind: "response"; id: string; error: { code: RpcErrorCode; message: string } };

export interface ExtensionRegistration {
  kind: "register";
  role: "extension";
  workspaceId: string;
  connectionId: string;
  schemaVersion: typeof schemaVersion;
}

export interface ClientRegistration {
  kind: "register";
  role: "client";
}

export type WireMessage = ExtensionRegistration | ClientRegistration | RpcRequest | RpcResponse;
