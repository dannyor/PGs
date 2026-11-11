import assert from "node:assert/strict";
import test from "node:test";

import { buildReviewOutline } from "../extension/review-outline.js";
import { handleReviewRequest, type ReviewLoader } from "../extension/review-boundary.js";
import { createReviewProgress } from "../protocol/review-state.js";
import { descriptor } from "./fixtures.js";

/*
 * SPECIFICATION TESTS — SLICE 2
 *
 * These tests are the reader-first executable specification of loading one
 * coherent, traceable review session. Malformed descriptor variants belong in
 * Slice 2 coverage tests.
 */

test("2.1 loading a valid descriptor produces a complete review overview with the first item current", () => {
  const progress = createReviewProgress(descriptor());

  const outline = buildReviewOutline(progress);

  assert.equal(outline.title, "Route one request");
  assert.equal(outline.promise, "A ready request reaches its intended handler.");
  assert.deepEqual(outline.scenarios.map((scenario) => scenario.id), ["1.1"]);
  assert.deepEqual(outline.scenarioGroups.map((group) => ({
    scenarioId: group.scenario.id,
    testItems: group.testItems.map((item) => item.id),
    mainItems: group.mainItems.map((item) => item.id)
  })), [{ scenarioId: "1.1", testItems: ["spec-1"], mainItems: ["impl-1"] }]);
  assert.deepEqual(outline.progress, { understood: 0, skipped: 0, total: 2, complete: false });
  assert.equal(outline.items[0]?.id, "spec-1");
  assert.equal(outline.items[0]?.current, true);
});

test("2.2 a review item preserves its scenario, intent, and exact source location", () => {
  const outline = buildReviewOutline(createReviewProgress(descriptor()));

  assert.deepEqual(outline.items[0], {
    id: "spec-1",
    title: "Executable behavior",
    kind: "specification",
    codeRole: "test",
    intent: "Shows the observable routing promise.",
    scenarioIds: ["1.1"],
    location: { path: "test/router.spec.ts", line: 10, column: 1 },
    status: "unviewed",
    current: true
  });
});

test("2.3 an invalid descriptor leaves the existing review intact", async () => {
  let activeReviewId = "existing-review";
  const loader: ReviewLoader = {
    currentReviewId: () => activeReviewId,
    load: async (loaded) => { activeReviewId = loaded.id; }
  };
  const invalid = structuredClone(descriptor()) as unknown as Record<string, unknown>;
  invalid.scenarios = [];

  const response = await handleReviewRequest(
    { kind: "request", id: "invalid-load", workspaceId: "/workspace", method: "review.load", params: invalid },
    { workspaceId: "/workspace", loader }
  );

  assert.equal(activeReviewId, "existing-review");
  assert.deepEqual(response, {
    kind: "response",
    id: "invalid-load",
    error: { code: "invalid-descriptor", message: "scenarios must be a non-empty array" }
  });
});

test("2.4 explicitly loading another valid slice replaces the session and reports the transition", async () => {
  let activeReviewId = "slice-1";
  const loader: ReviewLoader = {
    currentReviewId: () => activeReviewId,
    load: async (loaded) => { activeReviewId = loaded.id; }
  };
  const replacement = { ...descriptor(), id: "slice-2", title: "Replacement slice" };

  const response = await handleReviewRequest(
    { kind: "request", id: "replace", workspaceId: "/workspace", method: "review.load", params: replacement },
    { workspaceId: "/workspace", loader }
  );

  assert.equal(activeReviewId, "slice-2");
  assert.deepEqual(response, {
    kind: "response",
    id: "replace",
    result: { reviewId: "slice-2", itemCount: 2, replacedReviewId: "slice-1" }
  });
});
