import assert from "node:assert/strict";
import test from "node:test";

import { buildReviewOutline } from "../extension/review-outline.js";
import { askQuestion, createReviewProgress, eventsAfter, markItem } from "../protocol/review-state.js";
import { descriptor } from "./fixtures.js";

/*
 * SPECIFICATION TESTS — SLICE 3
 *
 * These tests are the reader-first executable specification of human responses
 * to declared intent. Defensive and repeated-action variants belong in coverage.
 */

test("3.1 marking the current intent understood advances to the next item", () => {
  const progress = createReviewProgress(descriptor());

  const event = markItem(progress, "spec-1", "understood");

  assert.equal(progress.itemStatuses["spec-1"], "understood");
  assert.equal(progress.currentItemId, "impl-1");
  assert.deepEqual(event, { sequence: 1, type: "intent-understood", itemId: "spec-1" });
});

test("3.2 asking about an intent keeps it current and records the human response", () => {
  const progress = createReviewProgress(descriptor());

  const event = askQuestion(progress, "spec-1", "Is this the right observable outcome?");

  assert.equal(progress.currentItemId, "spec-1");
  assert.deepEqual(progress.questions, [{
    itemId: "spec-1",
    text: "Is this the right observable outcome?",
    sequence: 1
  }]);
  assert.deepEqual(progress.events, [event]);
});

test("3.3 skipping remains distinct from understanding and advances", () => {
  const progress = createReviewProgress(descriptor());

  const event = markItem(progress, "spec-1", "skipped");

  assert.equal(progress.itemStatuses["spec-1"], "skipped");
  assert.equal(progress.currentItemId, "impl-1");
  assert.deepEqual(event, { sequence: 1, type: "item-skipped", itemId: "spec-1" });
});

test("3.4 retrieving after a known sequence returns ordered new events without duplicates", () => {
  const progress = createReviewProgress(descriptor());
  markItem(progress, "spec-1", "understood");
  askQuestion(progress, "impl-1", "What invariant does this implementation preserve?");

  const firstRead = eventsAfter(progress, 1);
  const repeatedRead = eventsAfter(progress, 1);

  assert.deepEqual(firstRead, [{
    sequence: 2,
    type: "question-asked",
    itemId: "impl-1",
    text: "What invariant does this implementation preserve?"
  }]);
  assert.deepEqual(repeatedRead, firstRead);
});

test("3.5 completion reports understood and skipped coverage without approval", () => {
  const progress = createReviewProgress(descriptor());
  markItem(progress, "spec-1", "understood");
  markItem(progress, "impl-1", "skipped");

  const outline = buildReviewOutline(progress);

  assert.deepEqual(outline.progress, { understood: 1, skipped: 1, total: 2, complete: true });
  assert.equal(progress.currentItemId, undefined);
  assert.equal("approved" in outline.progress, false);
});
