import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { ErrorObject } from "ajv";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ChunkView, ElementView, PresentationDescriptor, ReferenceTarget } from "../shared/types.js";
import { resolveDisplayRange } from "./cpp.js";

export class ChunkStore {
  readonly #workspace: string;
  readonly #validate;
  #descriptor?: PresentationDescriptor;
  #elements = new Map<string, ElementView>();

  constructor(workspace: string, schema: object) {
    this.#workspace = resolve(workspace);
    this.#validate = new Ajv2020({ allErrors: true }).compile<PresentationDescriptor>(schema);
  }

  async load(descriptorPath: string): Promise<void> {
    const candidate = JSON.parse(await readFile(descriptorPath, "utf8")) as unknown;
    if (!this.#validate(candidate)) {
      throw new Error(formatValidationErrors(this.#validate.errors));
    }

    const elements = new Map<string, ElementView>();
    const blockIds = new Set(candidate.presentation.blocks.map((block) => block.id));
    validateContainment(candidate.presentation.blocks);
    const functions = candidate.presentation.functions ?? [];
    const functionIds = new Set<string>();
    for (const fn of functions) {
      if (functionIds.has(fn.id)) throw new Error(`Duplicate function id: ${fn.id}`);
      functionIds.add(fn.id);
      if (!blockIds.has(fn.ownerBlockId)) {
        throw new Error(`Function ${fn.id} references unknown owner Block: ${fn.ownerBlockId}`);
      }
    }
    const scenarioIds = new Set<string>();
    for (const scenario of candidate.presentation.scenarios) {
      if (scenarioIds.has(scenario.id)) throw new Error(`Duplicate scenario id: ${scenario.id}`);
      scenarioIds.add(scenario.id);
      for (const participant of scenario.participants) {
        if (!blockIds.has(participant.blockId)) {
          throw new Error(`Scenario ${scenario.id} references unknown block: ${participant.blockId}`);
        }
      }
      for (const fn of scenario.functions ?? []) {
        if (!functionIds.has(fn.functionId)) {
          throw new Error(`Scenario ${scenario.id} references unknown function: ${fn.functionId}`);
        }
      }
      validateScenarioSequence(scenario.id, scenario.sequence ?? [], functionIds, new Set<string>());
      const coverageIds = new Set<string>();
      for (const coverage of scenario.coverageCases ?? []) {
        if (coverageIds.has(coverage.id)) throw new Error(`Scenario ${scenario.id} repeats coverage case: ${coverage.id}`);
        coverageIds.add(coverage.id);
      }
    }
    validateBehaviorHierarchy(candidate.presentation.behaviorAreas ?? [], scenarioIds);

    for (const element of candidate.presentation.blocks) {
      if (elements.has(element.id)) {
        throw new Error(`Duplicate element id: ${element.id}`);
      }
      const sourcePath = this.resolveWorkspacePath(element.path);
      const source = await readFile(sourcePath, "utf8");
      elements.set(element.id, {
        ...element,
        source,
        display: resolveDisplayRange(source, element),
        references: candidate.references?.filter((reference) => reference.source.path === element.path) ?? []
      });
    }

    this.#descriptor = candidate;
    this.#elements = elements;
  }

  getChunk(): ChunkView | undefined {
    if (!this.#descriptor) return undefined;
    return {
      id: this.#descriptor.presentation.id,
      label: this.#descriptor.presentation.label,
      elements: [...this.#elements.values()].map(({ source: _source, ...element }) => element),
      functions: this.#descriptor.presentation.functions ?? [],
      scenarios: this.#descriptor.presentation.scenarios,
      behaviorAreas: this.#descriptor.presentation.behaviorAreas ?? [],
      relationships: this.#descriptor.relationships ?? []
    };
  }

  getElement(id: string): ElementView | undefined {
    return this.#elements.get(id);
  }

  async loadTarget(target: ReferenceTarget): Promise<ElementView> {
    const source = await readFile(this.resolveWorkspacePath(target.path), "utf8");
    const element = {
      id: `external:${target.path}:${target.symbol}`,
      ...target
    };
    return {
      ...element,
      source,
      display: resolveDisplayRange(source, element),
      references: this.#descriptor?.references?.filter(
        (reference) => reference.source.path === target.path
      ) ?? []
    };
  }

  private resolveWorkspacePath(path: string): string {
    const candidate = resolve(this.#workspace, path);
    const remainder = relative(this.#workspace, candidate);
    if (isAbsolute(remainder) || remainder.startsWith("..")) {
      throw new Error(`Source path escapes workspace: ${path}`);
    }
    return candidate;
  }
}

function validateBehaviorHierarchy(
  areas: NonNullable<PresentationDescriptor["presentation"]["behaviorAreas"]>,
  scenarioIds: ReadonlySet<string>
): void {
  if (areas.length === 0) return;
  const areaIds = new Set<string>();
  const capabilityIds = new Set<string>();
  const assignedScenarios = new Set<string>();
  for (const area of areas) {
    if (areaIds.has(area.id)) throw new Error(`Duplicate behavior area id: ${area.id}`);
    areaIds.add(area.id);
    for (const capability of area.capabilities) {
      if (capabilityIds.has(capability.id)) throw new Error(`Duplicate capability id: ${capability.id}`);
      capabilityIds.add(capability.id);
      for (const scenarioId of capability.scenarioIds) {
        if (!scenarioIds.has(scenarioId)) throw new Error(`Capability ${capability.id} references unknown scenario: ${scenarioId}`);
        if (assignedScenarios.has(scenarioId)) throw new Error(`Scenario appears in more than one capability: ${scenarioId}`);
        assignedScenarios.add(scenarioId);
      }
    }
  }
  for (const scenarioId of scenarioIds) {
    if (!assignedScenarios.has(scenarioId)) throw new Error(`Scenario is not assigned to a capability: ${scenarioId}`);
  }
}

function validateScenarioSequence(
  scenarioId: string,
  steps: NonNullable<PresentationDescriptor["presentation"]["scenarios"][number]["sequence"]>,
  functionIds: ReadonlySet<string>,
  stepIds: Set<string>
): void {
  for (const step of steps) {
    if (stepIds.has(step.id)) throw new Error(`Scenario ${scenarioId} repeats sequence step: ${step.id}`);
    stepIds.add(step.id);
    if (!functionIds.has(step.functionId)) {
      throw new Error(`Scenario ${scenarioId} sequence references unknown function: ${step.functionId}`);
    }
    validateScenarioSequence(scenarioId, step.children ?? [], functionIds, stepIds);
  }
}

function validateContainment(blocks: PresentationDescriptor["presentation"]["blocks"]): void {
  const roots = blocks.filter((block) => block.parentId === undefined);
  if (roots.length !== 1) {
    throw new Error(`Block containment requires exactly one root; found ${roots.length}`);
  }
  const byId = new Map(blocks.map((block) => [block.id, block]));
  for (const block of blocks) {
    if (block.parentId !== undefined && !byId.has(block.parentId)) {
      throw new Error(`Block ${block.id} references unknown parent: ${block.parentId}`);
    }
    if (block.parentId === block.id) throw new Error(`Block ${block.id} cannot contain itself`);
  }

  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) throw new Error(`Block containment contains a cycle at: ${id}`);
    visited.add(id);
    for (const child of blocks.filter((block) => block.parentId === id)) visit(child.id);
  };
  visit(roots[0]!.id);
  if (visited.size !== blocks.length) {
    const unreachable = blocks.find((block) => !visited.has(block.id));
    throw new Error(`Block is not reachable from root ${roots[0]!.id}: ${unreachable?.id ?? "unknown"}`);
  }
}

function formatValidationErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors?.length) return "Invalid chunk descriptor";
  return errors.map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ");
}
