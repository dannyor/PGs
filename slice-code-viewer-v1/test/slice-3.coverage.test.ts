import assert from "node:assert/strict";
import test from "node:test";

import { createReviewProgress, markItem } from "../protocol/review-state.js";
import { descriptor } from "./fixtures.js";

test("coverage for 3.1 and 3.3: a terminal human outcome cannot be applied twice", () => {
  const progress = createReviewProgress(descriptor());
  const firstEvent = markItem(progress, "spec-1", "understood");
  const currentAfterFirstAction = progress.currentItemId;

  const repeatedUnderstanding = markItem(progress, "spec-1", "understood");
  const attemptedReplacement = markItem(progress, "spec-1", "skipped");

  assert.deepEqual(firstEvent, { sequence: 1, type: "intent-understood", itemId: "spec-1" });
  assert.equal(repeatedUnderstanding, undefined);
  assert.equal(attemptedReplacement, undefined);
  assert.equal(progress.itemStatuses["spec-1"], "understood");
  assert.equal(progress.currentItemId, currentAfterFirstAction);
  assert.equal(progress.nextSequence, 2);
  assert.equal(progress.events.length, 1);
});
