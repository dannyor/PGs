import assert from "node:assert/strict";
import test from "node:test";

import { createReviewProgress, restoreReviewProgress } from "../protocol/review-state.js";
import { descriptor } from "./fixtures.js";

test("coverage for 4.3: obsolete or incomplete saved state is rejected as malformed", () => {
  const obsolete = createReviewProgress(descriptor());
  obsolete.itemStatuses["spec-1"] = "viewed" as "understood";
  const incomplete = { descriptor: descriptor(), itemStatuses: {} };

  assert.deepEqual(restoreReviewProgress(obsolete, "/workspace"), {
    status: "rejected",
    reason: "malformed-state",
    message: "Saved review state is malformed."
  });
  assert.deepEqual(restoreReviewProgress(incomplete, "/workspace"), {
    status: "rejected",
    reason: "malformed-state",
    message: "Saved review state is malformed."
  });
});
