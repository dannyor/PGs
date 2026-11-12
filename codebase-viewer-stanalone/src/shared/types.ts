import type {
  CodeBlock,
  CodeRelationship,
  CodeScenario,
  CodeFunction,
  PresentationView,
  ReferenceHint,
  ReferenceRole,
  ReferenceTarget,
  ScaffoldingRegion,
  SourceRange
} from "./presentation.js";

export * from "./presentation.js";

// Temporary renderer compatibility while slice-review decorations are removed.
export type ReviewKind = import("./presentation.js").CodeType;
export type SegmentChange = "new" | "modified";
export interface ReviewSegment {
  id: string;
  intentKind: ReviewKind;
  change: SegmentChange;
  intent: string;
  ranges: SourceRange[];
}

export type ChunkElement = CodeBlock & { segments?: ReviewSegment[] };
export interface ElementView {
  id: string;
  kind: "class" | "struct" | "enum" | "function" | "field";
  symbol: string;
  path: string;
  role?: string;
  codeTypes?: import("./presentation.js").CodeType[];
  parentId?: string;
  focus?: SourceRange[];
  segments?: ReviewSegment[];
  scaffolding?: ScaffoldingRegion[];
  source: string;
  display: SourceRange;
  references: ReferenceHint[];
}
export interface ChunkView extends Omit<PresentationView, "blocks"> {
  elements: Array<Omit<ElementView, "source">>;
}

export type {
  CodeRelationship,
  CodeScenario,
  CodeFunction,
  ReferenceHint,
  ReferenceRole,
  ReferenceTarget,
  ScaffoldingRegion,
  SourceRange
};
