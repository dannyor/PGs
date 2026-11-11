import assert from "node:assert/strict";
import test from "node:test";

import { parseReviewDescriptor } from "../protocol/validation.js";
import { descriptor } from "./fixtures.js";

test("coverage for 2.1: a coherent descriptor preserves scenario and item relationships", () => {
  const parsed = parseReviewDescriptor(descriptor(), "/workspace");

  assert.equal(parsed.scenarios[0]?.id, "1.1");
  assert.deepEqual(parsed.items[0]?.scenarioIds, ["1.1"]);
});

test("coverage for 2.3: a review item cannot reference an unknown scenario", () => {
  const candidate = descriptor() as unknown as Record<string, unknown>;
  const items = structuredClone(candidate.items) as Array<Record<string, unknown>>;
  items[0] = { ...items[0], scenarioIds: ["1.99"] };
  candidate.items = items;

  assert.throws(() => parseReviewDescriptor(candidate), /unknown scenario 1\.99/);
});

test("coverage for 2.3: duplicate item identities are rejected", () => {
  const candidate = descriptor() as unknown as Record<string, unknown>;
  const items = structuredClone(candidate.items) as Array<Record<string, unknown>>;
  items[1] = { ...items[1], id: items[0]?.id };
  candidate.items = items;

  assert.throws(() => parseReviewDescriptor(candidate), /duplicate item id/);
});

test("coverage for 2.3: descriptor locations cannot escape the workspace", () => {
  const candidate = descriptor() as unknown as Record<string, unknown>;
  const items = structuredClone(candidate.items) as Array<Record<string, unknown>>;
  items[0] = { ...items[0], location: { path: "../secret", line: 1, column: 1 } };
  candidate.items = items;

  assert.throws(() => parseReviewDescriptor(candidate), /stay within the workspace/);
});

test("coverage for 2.3: every scenario requires both test code and main code", () => {
  const missingMain = descriptor() as unknown as Record<string, unknown>;
  missingMain.items = (structuredClone(missingMain.items) as Array<Record<string, unknown>>)
    .filter((item) => item.codeRole === "test");
  const missingTest = descriptor() as unknown as Record<string, unknown>;
  missingTest.items = (structuredClone(missingTest.items) as Array<Record<string, unknown>>)
    .filter((item) => item.codeRole === "main");

  assert.throws(() => parseReviewDescriptor(missingMain), /scenario 1\.1 must reference main code/);
  assert.throws(() => parseReviewDescriptor(missingTest), /scenario 1\.1 must reference test code/);
});

test("coverage for 3.2: empty questions are rejected", async () => {
  const { askQuestion, createReviewProgress } = await import("../protocol/review-state.js");
  const progress = createReviewProgress(descriptor());

  assert.throws(() => askQuestion(progress, "spec-1", "   "), /must not be empty/);
});
