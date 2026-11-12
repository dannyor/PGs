import { describe, expect, it } from "vitest";

import type { CodeFunction, CodeScenario } from "../shared/types";
import { aggregateScenarioEntities, resolveScenarioSteps, scenarioLaneIds, scenarioSteps } from "./scenario-sequence";

const functions: CodeFunction[] = [
  { id: "a.run", symbol: "TypeA::run", path: "a.cpp", ownerBlockId: "a" },
  { id: "b.read", symbol: "TypeB::read", path: "b.cpp", ownerBlockId: "b" },
  { id: "a.finish", symbol: "TypeA::finish", path: "a.cpp", ownerBlockId: "a" }
];

const scenario: CodeScenario = {
  id: "flow", title: "Flow", actor: "Caller", startingState: "Ready", action: "Run", result: "Done",
  participants: [{ blockId: "a", role: "coordinates" }, { blockId: "b", role: "reads" }],
  functions: [], evidence: [{ kind: "main", label: "flow", path: "a.cpp", line: 1 }],
  sequence: [{
    id: "run", functionId: "a.run", children: [
      { id: "read", functionId: "b.read" },
      { id: "finish", functionId: "a.finish" }
    ]
  }]
};

describe("Scenario sequence projections", () => {
  it("preserves nested order and numbering", () => {
    expect(resolveScenarioSteps(scenario, functions).map((step) => [step.number, step.functionId, step.depth])).toEqual([
      ["1", "a.run", 0], ["1.1", "b.read", 1], ["1.2", "a.finish", 1]
    ]);
  });

  it("derives caller ownership for nested calls", () => {
    expect(resolveScenarioSteps(scenario, functions).map((step) => step.callerBlockId)).toEqual([undefined, "a", "a"]);
  });

  it("returns unique Entity lanes in call order", () => {
    expect(scenarioLaneIds(resolveScenarioSteps(scenario, functions))).toEqual(["a", "b"]);
  });

  it("aggregates every involved Entity once while preserving its Function order", () => {
    expect(aggregateScenarioEntities(resolveScenarioSteps(scenario, functions)).map((entry) => [
      entry.blockId,
      entry.functions.map((fn) => fn.id)
    ])).toEqual([
      ["a", ["a.run", "a.finish"]],
      ["b", ["b.read"]]
    ]);
  });

  it("falls back to the Scenario function order when no hierarchy is supplied", () => {
    const fallback = { ...scenario, sequence: undefined, functions: [{ functionId: "a.run", role: "start" }, { functionId: "b.read", role: "read" }] };
    expect(scenarioSteps(fallback).map((step) => step.functionId)).toEqual(["a.run", "b.read"]);
  });
});
