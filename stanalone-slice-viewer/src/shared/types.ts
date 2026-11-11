export type ElementKind = "class" | "struct" | "enum" | "function" | "field";
export type ReferenceRole = "type" | "function" | "constant" | "field";
export type ReviewKind = "behavior" | "contract" | "structure" | "wiring";
export type SegmentChange = "new" | "modified";
export type RelationshipKind = "calls" | "reads" | "writes";
export type RelationshipCertainty = "direct" | "possible";

export interface SourceRange {
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}

export interface ScaffoldingRegion extends SourceRange {
  label: string;
}

export interface ReviewSegment {
  id: string;
  intentKind: ReviewKind;
  change: SegmentChange;
  intent: string;
  ranges: SourceRange[];
}

export interface ChunkElement {
  id: string;
  kind: ElementKind;
  symbol: string;
  path: string;
  focus?: SourceRange[];
  segments?: ReviewSegment[];
  scaffolding?: ScaffoldingRegion[];
}

export interface ReferenceTarget {
  kind: ElementKind;
  symbol: string;
  path: string;
}

export interface ReferenceSource {
  path: string;
  line: number;
  column: number;
  length?: number;
  role?: ReferenceRole;
}

export interface LocalReferenceHint {
  source: ReferenceSource;
  target: ReferenceTarget;
}

export interface OriginReferenceHint {
  source: ReferenceSource;
  origin: string;
}

export type ReferenceHint = LocalReferenceHint | OriginReferenceHint;

export interface RelationshipSite {
  path: string;
  line: number;
  column?: number;
  length?: number;
}

export interface CodeRelationship {
  kind: RelationshipKind;
  from: ReferenceTarget;
  to: ReferenceTarget;
  sites: RelationshipSite[];
  certainty?: RelationshipCertainty;
}

export interface ChunkDescriptor {
  version: 1 | 2;
  chunk: { id: string; label: string; elements: ChunkElement[] };
  references?: ReferenceHint[];
  relationships?: CodeRelationship[];
}

export interface ElementView extends ChunkElement {
  source: string;
  display: SourceRange;
  references: ReferenceHint[];
}

export interface ChunkView {
  id: string;
  label: string;
  elements: Array<Omit<ElementView, "source">>;
  relationships: CodeRelationship[];
}
