import { posix } from "node:path";

import { type ReviewDescriptor, type ReviewItem, schemaVersion } from "./types.js";

export class DescriptorValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DescriptorValidationError";
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DescriptorValidationError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new DescriptorValidationError(`${key} must be a non-empty string`);
  }
  return value;
}

function validateLocation(value: unknown, itemId: string): ReviewItem["location"] {
  const location = requireRecord(value, `location for ${itemId}`);
  const path = requireString(location, "path");
  if (posix.isAbsolute(path) || path.split("/").includes("..")) {
    throw new DescriptorValidationError(`item ${itemId} path must stay within the workspace`);
  }
  const line = location.line;
  const column = location.column;
  if (!Number.isInteger(line) || (line as number) < 1 || !Number.isInteger(column) || (column as number) < 1) {
    throw new DescriptorValidationError(`item ${itemId} location must use positive one-based coordinates`);
  }
  return { path, line: line as number, column: column as number };
}

export function parseReviewDescriptor(value: unknown, expectedWorkspaceId?: string): ReviewDescriptor {
  const descriptor = requireRecord(value, "descriptor");
  if (descriptor.schemaVersion !== schemaVersion) {
    throw new DescriptorValidationError(`unsupported schema version ${String(descriptor.schemaVersion)}`);
  }

  const id = requireString(descriptor, "id");
  const title = requireString(descriptor, "title");
  const promise = requireString(descriptor, "promise");
  const workspaceId = requireString(descriptor, "workspaceId");
  if (expectedWorkspaceId !== undefined && workspaceId !== expectedWorkspaceId) {
    throw new DescriptorValidationError("descriptor belongs to a different workspace");
  }

  if (!Array.isArray(descriptor.scenarios) || descriptor.scenarios.length === 0) {
    throw new DescriptorValidationError("scenarios must be a non-empty array");
  }
  const scenarioIds = new Set<string>();
  const scenarios = descriptor.scenarios.map((value, index) => {
    const scenario = requireRecord(value, `scenario ${index + 1}`);
    const scenarioId = requireString(scenario, "id");
    if (scenarioIds.has(scenarioId)) throw new DescriptorValidationError(`duplicate scenario id ${scenarioId}`);
    scenarioIds.add(scenarioId);
    return { id: scenarioId, title: requireString(scenario, "title"), behavior: requireString(scenario, "behavior") };
  });

  if (!Array.isArray(descriptor.items) || descriptor.items.length === 0) {
    throw new DescriptorValidationError("items must be a non-empty array");
  }
  const itemIds = new Set<string>();
  const validKinds = new Set(["specification", "implementation", "boundary", "context"]);
  const validCodeRoles = new Set(["main", "test"]);
  const items = descriptor.items.map((value, index): ReviewItem => {
    const item = requireRecord(value, `item ${index + 1}`);
    const itemId = requireString(item, "id");
    if (itemIds.has(itemId)) throw new DescriptorValidationError(`duplicate item id ${itemId}`);
    itemIds.add(itemId);
    if (typeof item.kind !== "string" || !validKinds.has(item.kind)) {
      throw new DescriptorValidationError(`item ${itemId} has an invalid kind`);
    }
    if (typeof item.codeRole !== "string" || !validCodeRoles.has(item.codeRole)) {
      throw new DescriptorValidationError(`item ${itemId} has an invalid code role`);
    }
    if (!Array.isArray(item.scenarioIds) || item.scenarioIds.length === 0) {
      throw new DescriptorValidationError(`item ${itemId} must reference a scenario`);
    }
    const referencedScenarios = item.scenarioIds.map(String);
    const missing = referencedScenarios.find((scenarioId) => !scenarioIds.has(scenarioId));
    if (missing !== undefined) throw new DescriptorValidationError(`item ${itemId} references unknown scenario ${missing}`);
    return {
      id: itemId,
      title: requireString(item, "title"),
      kind: item.kind as ReviewItem["kind"],
      codeRole: item.codeRole as ReviewItem["codeRole"],
      intent: requireString(item, "intent"),
      scenarioIds: referencedScenarios,
      location: validateLocation(item.location, itemId)
    };
  });

  for (const scenario of scenarios) {
    const scenarioItems = items.filter((item) => item.scenarioIds.includes(scenario.id));
    if (!scenarioItems.some((item) => item.codeRole === "test")) {
      throw new DescriptorValidationError(`scenario ${scenario.id} must reference test code`);
    }
    if (!scenarioItems.some((item) => item.codeRole === "main")) {
      throw new DescriptorValidationError(`scenario ${scenario.id} must reference main code`);
    }
  }

  return { schemaVersion, id, title, promise, workspaceId, scenarios, items };
}
