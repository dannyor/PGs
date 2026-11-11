import { schemaVersion, type ReviewDescriptor } from "../protocol/types.js";

export function descriptor(workspaceId = "/workspace"): ReviewDescriptor {
  return {
    schemaVersion,
    id: "slice-1",
    title: "Route one request",
    promise: "A ready request reaches its intended handler.",
    workspaceId,
    scenarios: [
      { id: "1.1", title: "Ready request", behavior: "Given a ready request, routing delivers it to the handler." }
    ],
    items: [
      {
        id: "spec-1",
        title: "Executable behavior",
        kind: "specification",
        codeRole: "test",
        intent: "Shows the observable routing promise.",
        scenarioIds: ["1.1"],
        location: { path: "test/router.spec.ts", line: 10, column: 1 }
      },
      {
        id: "impl-1",
        title: "Routing decision",
        kind: "implementation",
        codeRole: "main",
        intent: "Selects the intended handler.",
        scenarioIds: ["1.1"],
        location: { path: "src/router.ts", line: 20, column: 3 }
      }
    ]
  };
}
