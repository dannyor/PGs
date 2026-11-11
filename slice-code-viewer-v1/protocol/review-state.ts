import { type ReviewDescriptor, type ReviewEvent, type ReviewProgress } from "./types.js";
import { DescriptorValidationError, parseReviewDescriptor } from "./validation.js";

export type ReviewRestoreResult =
  | { status: "empty" }
  | { status: "restored"; progress: ReviewProgress }
  | {
      status: "rejected";
      reason: "incompatible-schema" | "different-workspace" | "malformed-state";
      message: string;
    };

export function createReviewProgress(descriptor: ReviewDescriptor): ReviewProgress {
  return {
    descriptor,
    currentItemId: descriptor.items[0]?.id,
    itemStatuses: Object.fromEntries(descriptor.items.map((item) => [item.id, "unviewed"])),
    questions: [],
    events: [],
    nextSequence: 1
  };
}

function requireItem(progress: ReviewProgress, itemId: string): void {
  if (!progress.descriptor.items.some((item) => item.id === itemId)) {
    throw new Error(`unknown review item ${itemId}`);
  }
}

function nextUnviewed(progress: ReviewProgress, afterItemId: string): string | undefined {
  const currentIndex = progress.descriptor.items.findIndex((item) => item.id === afterItemId);
  return progress.descriptor.items.slice(currentIndex + 1).find((item) => progress.itemStatuses[item.id] === "unviewed")?.id;
}

export function markItem(progress: ReviewProgress, itemId: string, status: "understood" | "skipped"): ReviewEvent | undefined {
  requireItem(progress, itemId);
  if (progress.itemStatuses[itemId] !== "unviewed") return undefined;
  progress.itemStatuses[itemId] = status;
  progress.currentItemId = nextUnviewed(progress, itemId);
  const event: ReviewEvent = {
    sequence: progress.nextSequence++,
    type: status === "understood" ? "intent-understood" : "item-skipped",
    itemId
  };
  progress.events.push(event);
  return event;
}

export function askQuestion(progress: ReviewProgress, itemId: string, text: string): ReviewEvent {
  requireItem(progress, itemId);
  const question = text.trim();
  if (question === "") throw new Error("question must not be empty");
  const sequence = progress.nextSequence++;
  progress.questions.push({ itemId, text: question, sequence });
  progress.currentItemId = itemId;
  const event: ReviewEvent = { sequence, type: "question-asked", itemId, text: question };
  progress.events.push(event);
  return event;
}

export function eventsAfter(progress: ReviewProgress, sequence: number): ReviewEvent[] {
  return progress.events.filter((event) => event.sequence > sequence);
}

export function restoreReviewProgress(value: unknown, workspaceId: string): ReviewRestoreResult {
  if (value === undefined) return { status: "empty" };
  if (typeof value !== "object" || value === null) {
    return { status: "rejected", reason: "malformed-state", message: "Saved review state is malformed." };
  }
  const candidate = value as Partial<ReviewProgress>;
  if (candidate.descriptor === undefined) {
    return { status: "rejected", reason: "malformed-state", message: "Saved review state is malformed." };
  }
  if (candidate.descriptor.schemaVersion !== 1) {
    return {
      status: "rejected",
      reason: "incompatible-schema",
      message: `Saved review uses unsupported schema version ${String(candidate.descriptor.schemaVersion)}.`
    };
  }
  if (candidate.descriptor.workspaceId !== workspaceId) {
    return {
      status: "rejected",
      reason: "different-workspace",
      message: "Saved review belongs to a different workspace."
    };
  }
  try {
    candidate.descriptor = parseReviewDescriptor(candidate.descriptor, workspaceId);
  } catch (error) {
    if (error instanceof DescriptorValidationError) {
      return { status: "rejected", reason: "malformed-state", message: `Saved review state is malformed: ${error.message}.` };
    }
    throw error;
  }
  const statuses = candidate.itemStatuses === undefined ? [] : Object.values(candidate.itemStatuses);
  const validStatuses = statuses.every((status) => status === "unviewed" || status === "understood" || status === "skipped");
  const hasEveryStatus = candidate.descriptor.items.every((item) => candidate.itemStatuses?.[item.id] !== undefined);
  if (
    candidate.itemStatuses === undefined
    || !validStatuses
    || !hasEveryStatus
    || !Array.isArray(candidate.questions)
    || !Array.isArray(candidate.events)
    || !Number.isInteger(candidate.nextSequence)
  ) {
    return { status: "rejected", reason: "malformed-state", message: "Saved review state is malformed." };
  }
  return { status: "restored", progress: candidate as ReviewProgress };
}
