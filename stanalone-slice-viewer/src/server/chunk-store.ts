import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { ErrorObject } from "ajv";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ChunkDescriptor, ChunkView, ElementView, ReferenceTarget } from "../shared/types.js";
import { resolveDisplayRange } from "./cpp.js";

export class ChunkStore {
  readonly #workspace: string;
  readonly #validate;
  #descriptor?: ChunkDescriptor;
  #elements = new Map<string, ElementView>();

  constructor(workspace: string, schema: object) {
    this.#workspace = resolve(workspace);
    this.#validate = new Ajv2020({ allErrors: true }).compile<ChunkDescriptor>(schema);
  }

  async load(descriptorPath: string): Promise<void> {
    const candidate = JSON.parse(await readFile(descriptorPath, "utf8")) as unknown;
    if (!this.#validate(candidate)) {
      throw new Error(formatValidationErrors(this.#validate.errors));
    }

    const elements = new Map<string, ElementView>();
    for (const element of candidate.chunk.elements) {
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
      id: this.#descriptor.chunk.id,
      label: this.#descriptor.chunk.label,
      elements: [...this.#elements.values()].map(({ source: _source, ...element }) => element),
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

function formatValidationErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors?.length) return "Invalid chunk descriptor";
  return errors.map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ");
}
