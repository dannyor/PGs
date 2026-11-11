import assert from "node:assert/strict";
import test from "node:test";
import type * as vscode from "vscode";

import { ReviewSession } from "../extension/review-session.js";
import { askQuestion, createReviewProgress, markItem, restoreReviewProgress } from "../protocol/review-state.js";
import { descriptor } from "./fixtures.js";

/*
 * SPECIFICATION TESTS — SLICE 4
 *
 * These tests are the reader-first executable specification of durable review
 * resumption. Malformed-state variants belong in Slice 4 coverage tests.
 */

function memento(saved: unknown): vscode.Memento {
  return {
    keys: () => ["codexSliceReview.activeReview.v1"],
    get: <T>(_key: string, defaultValue?: T) => (saved ?? defaultValue) as T,
    update: async () => undefined
  };
}

test("4.1 reopening restores the same intent, progress, and pending questions", () => {
  const progress = createReviewProgress(descriptor());
  markItem(progress, "spec-1", "understood");
  askQuestion(progress, "impl-1", "Which invariant should I challenge?");

  const result = restoreReviewProgress(structuredClone(progress), "/workspace");

  assert.deepEqual(result, { status: "restored", progress });
});

test("4.2 a restarted extension restores review state with a fresh connection identity", () => {
  const progress = createReviewProgress(descriptor());
  markItem(progress, "spec-1", "understood");
  const saved = structuredClone(progress);

  const beforeRestart = new ReviewSession("/workspace", "connection-before", memento(saved), () => undefined);
  const afterRestart = new ReviewSession("/workspace", "connection-after", memento(saved), () => undefined);

  assert.deepEqual(afterRestart.current, beforeRestart.current);
  assert.equal(beforeRestart.connectionId, "connection-before");
  assert.equal(afterRestart.connectionId, "connection-after");
});

test("4.3 incompatible or foreign saved state stays inactive and explains why", () => {
  const incompatible = createReviewProgress(descriptor());
  incompatible.descriptor = { ...incompatible.descriptor, schemaVersion: 99 as 1 };
  const foreign = createReviewProgress(descriptor("/another-workspace"));

  const incompatibleResult = restoreReviewProgress(incompatible, "/workspace");
  const foreignResult = restoreReviewProgress(foreign, "/workspace");

  assert.deepEqual(incompatibleResult, {
    status: "rejected",
    reason: "incompatible-schema",
    message: "Saved review uses unsupported schema version 99."
  });
  assert.deepEqual(foreignResult, {
    status: "rejected",
    reason: "different-workspace",
    message: "Saved review belongs to a different workspace."
  });
});
