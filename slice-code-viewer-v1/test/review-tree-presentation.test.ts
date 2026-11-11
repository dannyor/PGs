import assert from "node:assert/strict";
import test from "node:test";

import { reviewItemIcon, reviewViewTitle } from "../extension/review-outline.js";
import { createReviewProgress } from "../protocol/review-state.js";
import { descriptor } from "./fixtures.js";

test("review status maps to native theme icons instead of label markup", () => {
  assert.equal(reviewItemIcon("understood", false), "check");
  assert.equal(reviewItemIcon("skipped", false), "debug-step-over");
  assert.equal(reviewItemIcon("unviewed", true), "arrow-right");
  assert.equal(reviewItemIcon("unviewed", false), "circle-outline");
});

test("the native view title follows the active slice title", () => {
  assert.equal(reviewViewTitle(undefined), "Active Slice");
  assert.equal(reviewViewTitle(createReviewProgress(descriptor())), "Route one request");
});
