import type { CodeFunction, CodeScenario, ScenarioStep } from "../shared/types";

export interface ResolvedScenarioStep {
  id: string;
  functionId: string;
  label?: string;
  depth: number;
  number: string;
  callerBlockId?: string;
  function: CodeFunction;
}

export interface ScenarioEntitySummary {
  blockId: string;
  functions: CodeFunction[];
}

export function scenarioSteps(scenario: CodeScenario): ScenarioStep[] {
  if (scenario.sequence?.length) return scenario.sequence;
  return (scenario.functions ?? []).map((entry, index) => ({
    id: `${scenario.id}-function-${index + 1}`,
    functionId: entry.functionId,
    label: entry.role
  }));
}

export function resolveScenarioSteps(
  scenario: CodeScenario,
  functions: readonly CodeFunction[]
): ResolvedScenarioStep[] {
  const byId = new Map(functions.map((fn) => [fn.id, fn]));
  const resolved: ResolvedScenarioStep[] = [];
  const visit = (steps: readonly ScenarioStep[], parentBlockId: string | undefined, prefix: number[]): void => {
    steps.forEach((step, index) => {
      const fn = byId.get(step.functionId);
      if (!fn) return;
      const path = [...prefix, index + 1];
      resolved.push({
        id: step.id,
        functionId: step.functionId,
        ...(step.label ? { label: step.label } : {}),
        depth: prefix.length,
        number: path.join("."),
        ...(parentBlockId ? { callerBlockId: parentBlockId } : {}),
        function: fn
      });
      visit(step.children ?? [], fn.ownerBlockId, path);
    });
  };
  visit(scenarioSteps(scenario), undefined, []);
  return resolved;
}

export function scenarioLaneIds(steps: readonly ResolvedScenarioStep[]): string[] {
  const lanes: string[] = [];
  for (const step of steps) {
    if (step.callerBlockId && !lanes.includes(step.callerBlockId)) lanes.push(step.callerBlockId);
    if (!lanes.includes(step.function.ownerBlockId)) lanes.push(step.function.ownerBlockId);
  }
  return lanes;
}

export function aggregateScenarioEntities(steps: readonly ResolvedScenarioStep[]): ScenarioEntitySummary[] {
  const entities = new Map<string, CodeFunction[]>();
  for (const step of steps) {
    const owned = entities.get(step.function.ownerBlockId);
    if (owned) owned.push(step.function);
    else entities.set(step.function.ownerBlockId, [step.function]);
  }
  return [...entities].map(([blockId, ownedFunctions]) => ({ blockId, functions: ownedFunctions }));
}
