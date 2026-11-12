export type BlockKind = "class" | "struct";
export type ReferenceRole = "type" | "function" | "constant" | "field";
export type RelationshipKind = "calls" | "reads" | "writes";
export type RelationshipCertainty = "direct" | "possible";
export type CodeType = "behavior" | "contract" | "structure" | "wiring";

export interface SourceRange {
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}

export interface ScaffoldingRegion extends SourceRange {
  label: string;
}

export interface CodeBlock {
  id: string;
  kind: BlockKind;
  symbol: string;
  path: string;
  role: string;
  codeTypes?: CodeType[];
  parentId?: string;
  focus?: SourceRange[];
  scaffolding?: ScaffoldingRegion[];
}

export interface CodeFunction {
  id: string;
  symbol: string;
  path: string;
  role?: string;
  codeTypes?: CodeType[];
  ownerBlockId: string;
  focus?: SourceRange[];
}

export interface ScenarioParticipant {
  blockId: string;
  role: string;
}

export interface ScenarioEvidence {
  kind: "specification" | "coverage" | "main" | "documentation";
  label: string;
  path: string;
  line: number;
  column?: number;
}

export interface ScenarioStep {
  id: string;
  functionId: string;
  label?: string;
  children?: ScenarioStep[];
}

export interface ScenarioCoverageCase {
  id: string;
  title: string;
  evidence: ScenarioEvidence[];
}

export interface CodeScenario {
  id: string;
  title: string;
  actor: string;
  startingState: string;
  action: string;
  result: string;
  participants: ScenarioParticipant[];
  functions?: Array<{ functionId: string; role: string }>;
  sequence?: ScenarioStep[];
  coverageCases?: ScenarioCoverageCase[];
  evidence: ScenarioEvidence[];
}

export interface BehaviorCapability {
  id: string;
  title: string;
  promise: string;
  scenarioIds: string[];
}

export interface BehaviorArea {
  id: string;
  title: string;
  description?: string;
  capabilities: BehaviorCapability[];
}

export interface ReferenceTarget {
  kind: "class" | "struct" | "enum" | "function" | "field";
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

export type ReferenceHint =
  | { source: ReferenceSource; target: ReferenceTarget }
  | { source: ReferenceSource; origin: string };

export interface CodeRelationship {
  kind: RelationshipKind;
  from: ReferenceTarget;
  to: ReferenceTarget;
  sites: RelationshipSite[];
  certainty?: RelationshipCertainty;
}

export interface RelationshipSite {
  path: string;
  line: number;
  column?: number;
  length?: number;
}

export interface PresentationDescriptor {
  version: 1;
  presentation: {
    id: string;
    label: string;
    blocks: CodeBlock[];
    functions?: CodeFunction[];
    scenarios: CodeScenario[];
    behaviorAreas?: BehaviorArea[];
  };
  references?: ReferenceHint[];
  relationships?: CodeRelationship[];
}

export interface BlockView extends CodeBlock {
  source: string;
  display: SourceRange;
  references: ReferenceHint[];
}

export interface PresentationView {
  id: string;
  label: string;
  blocks: Array<Omit<BlockView, "source">>;
  functions: CodeFunction[];
  scenarios: CodeScenario[];
  behaviorAreas: BehaviorArea[];
  relationships: CodeRelationship[];
}
