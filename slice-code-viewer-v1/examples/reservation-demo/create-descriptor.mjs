import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [, , workspaceId, outputPath] = process.argv;
if (!workspaceId || !outputPath) {
  throw new Error("usage: node create-descriptor.mjs <workspace-id> <output-path>");
}

const standaloneDemo = "examples/reservation-demo";
const umbrellaDemo = "codex-code-server-extension/examples/reservation-demo";
let root = standaloneDemo;
try {
  await access(join(workspaceId, standaloneDemo));
} catch {
  root = umbrellaDemo;
}
const descriptor = {
  schemaVersion: 1,
  id: "reservation-safety-demo",
  title: "Reservation safety",
  promise: "Reserve inventory exactly once for a retried request, and never partially consume stock when the full request cannot be satisfied.",
  workspaceId,
  scenarios: [
    {
      id: "DEMO.1",
      title: "Successful reservation",
      behavior: "Given sufficient stock, reserving all requested lines returns a confirmation and decrements every requested SKU."
    },
    {
      id: "DEMO.2",
      title: "Idempotent retry",
      behavior: "Given a previously accepted request, retrying the same request ID and content returns the original confirmation without consuming stock again."
    },
    {
      id: "DEMO.3",
      title: "Atomic rejection",
      behavior: "Given any insufficient line, the entire request is rejected with shortages and no inventory is consumed."
    }
  ],
  items: [
    {
      id: "spec-success",
      title: "Successful reservation specification",
      kind: "specification",
      codeRole: "test",
      intent: "Prove that a fully satisfiable request produces an observable confirmation and decrements every requested SKU.",
      scenarioIds: ["DEMO.1"],
      location: { path: `${root}/test/reservation.spec.test.ts`, line: 14, column: 1 }
    },
    {
      id: "spec-retry",
      title: "Idempotent retry specification",
      kind: "specification",
      codeRole: "test",
      intent: "Prove that request identity protects inventory from being consumed twice during a retry.",
      scenarioIds: ["DEMO.2"],
      location: { path: `${root}/test/reservation.spec.test.ts`, line: 28, column: 1 }
    },
    {
      id: "spec-rejection",
      title: "Atomic rejection specification",
      kind: "specification",
      codeRole: "test",
      intent: "Prove that one shortage rejects the complete request without partially changing otherwise available stock.",
      scenarioIds: ["DEMO.3"],
      location: { path: `${root}/test/reservation.spec.test.ts`, line: 40, column: 1 }
    },
    {
      id: "result-contract",
      title: "Observable result contract",
      kind: "boundary",
      codeRole: "main",
      intent: "Make reserved, rejected, and conflicting outcomes explicit so callers cannot confuse retry safety with stock rejection.",
      scenarioIds: ["DEMO.1", "DEMO.2", "DEMO.3"],
      location: { path: `${root}/src/types.ts`, line: 17, column: 1 }
    },
    {
      id: "inventory-owner",
      title: "Inventory mutation owner",
      kind: "implementation",
      codeRole: "main",
      intent: "Own the all-or-nothing stock mutation and prevent a rejected request from partially consuming inventory.",
      scenarioIds: ["DEMO.1", "DEMO.3"],
      location: { path: `${root}/src/inventory-ledger.ts`, line: 18, column: 1 }
    },
    {
      id: "reservation-orchestration",
      title: "Reservation orchestration",
      kind: "implementation",
      codeRole: "main",
      intent: "Coordinate retry identity, shortage detection, atomic inventory mutation, and confirmation recording in the required order.",
      scenarioIds: ["DEMO.1", "DEMO.2", "DEMO.3"],
      location: { path: `${root}/src/reservation-service.ts`, line: 16, column: 1 }
    }
  ]
};

await writeFile(outputPath, `${JSON.stringify(descriptor, null, 2)}\n`);
