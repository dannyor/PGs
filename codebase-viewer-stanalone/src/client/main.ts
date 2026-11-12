import { cpp } from "@codemirror/lang-cpp";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { EditorState, RangeSetBuilder, StateEffect, StateField, type Range } from "@codemirror/state";
import { Decoration, EditorView, lineNumbers, WidgetType, type DecorationSet } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import cytoscape, { type Core as CytoscapeCore } from "cytoscape";
import type { BehaviorArea, ChunkView, CodeFunction, CodeRelationship, CodeScenario, ElementView, ReferenceHint, ReferenceRole, ReferenceTarget, RelationshipSite, ReviewKind, ReviewSegment, ScaffoldingRegion, ScenarioEvidence, SegmentChange, SourceRange } from "../shared/types";
import { sidebarWidthForFunctionDrawer } from "./layout";
import { aggregateScenarioEntities, resolveScenarioSteps, scenarioLaneIds, scenarioSteps } from "./scenario-sequence";
import "./style.css";

const reviewKindOrder: ReviewKind[] = ["behavior", "contract", "structure", "wiring"];

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <aside>
    <header><p>CODEX CODEBASE</p><h1 id="chunk-title">Waiting for a presentation</h1></header>
    <div id="view-tabs"><button class="active" data-view="entities">Entities</button><button data-view="scenarios">Scenarios</button><button data-view="entity-map">Entity Map</button></div>
    <div id="entity-view">
      <nav id="elements" aria-label="Code entities"></nav>
      <section id="entity-scenarios" aria-label="Scenarios associated with selected entity">
        <div id="entity-scenarios-heading">Associated scenarios</div>
        <div id="entity-scenarios-list"></div>
      </section>
    </div>
    <div id="scenario-view" hidden>
      <nav id="scenarios" aria-label="Behavioral scenario hierarchy"></nav>
      <div id="scenario-detail-resizer" role="separator" aria-label="Resize selected Scenario panel" aria-orientation="horizontal" tabindex="0"></div>
      <section id="scenario-detail-panel" aria-label="Selected Scenario">
        <button id="scenario-detail-toggle" type="button" aria-expanded="true">Selected Scenario ▾</button>
        <div id="scenario-detail"></div>
      </section>
    </div>
    <section id="entity-map" aria-label="Entity containment map" hidden></section>
    <section id="flow-panel" aria-label="Selected symbol flow" hidden>
      <div class="flow-heading"><strong>Flow</strong><button id="close-flow" type="button" aria-label="Close flow inspector">×</button></div>
      <div id="flow-content"></div>
    </section>
    <div id="sidebar-footer">
      <p id="status" role="status">Write .codex/code-viewer/presentation.json to begin.</p>
      <button id="flow-button" type="button" aria-label="Toggle flow inspector" aria-expanded="false" aria-controls="flow-panel" title="Flow">⇄</button>
      <div id="legend">
        <button id="legend-button" type="button" aria-label="Code types legend" aria-expanded="false" aria-controls="legend-panel" title="Code types legend">▦</button>
        <div id="legend-panel" hidden>
          <strong>Code types</strong>
          <ul>
            <li>${reviewMarker("behavior")}<span>Behavior</span></li>
            <li>${reviewMarker("contract")}<span>Contract</span></li>
            <li>${reviewMarker("structure")}<span>Structure</span></li>
            <li>${reviewMarker("wiring")}<span>Wiring</span></li>
          </ul>
        </div>
      </div>
    </div>
  </aside>
  <div id="splitter" role="separator" aria-label="Resize chunk pane" aria-orientation="vertical" aria-valuemin="180" aria-valuemax="480" aria-valuenow="280" tabindex="0"></div>
  <main>
    <div id="toolbar">
      <button id="back" type="button" aria-label="Back" title="Back" disabled>←</button>
      <div id="location"></div>
      <div id="related-scenarios"></div>
      <div id="settings">
        <button id="settings-button" type="button" aria-label="Viewer settings" aria-expanded="false" aria-controls="settings-panel" title="Viewer settings">⚙</button>
        <div id="settings-panel" hidden>
          <strong>Viewer settings</strong>
          <label><input id="show-intents" type="checkbox" checked> Show intent descriptions</label>
        </div>
      </div>
    </div>
    <div id="code"></div>
  </main>
  <div id="entity-tooltip" role="tooltip" hidden></div>
`;

const title = document.querySelector<HTMLElement>("#chunk-title")!;
const elements = document.querySelector<HTMLElement>("#elements")!;
const entityView = document.querySelector<HTMLElement>("#entity-view")!;
const entityScenariosHeading = document.querySelector<HTMLElement>("#entity-scenarios-heading")!;
const entityScenariosList = document.querySelector<HTMLElement>("#entity-scenarios-list")!;
const scenarioList = document.querySelector<HTMLElement>("#scenarios")!;
const scenarioView = document.querySelector<HTMLElement>("#scenario-view")!;
const scenarioDetailPanel = document.querySelector<HTMLElement>("#scenario-detail-panel")!;
const scenarioDetail = document.querySelector<HTMLElement>("#scenario-detail")!;
const scenarioDetailToggle = document.querySelector<HTMLButtonElement>("#scenario-detail-toggle")!;
const scenarioDetailResizer = document.querySelector<HTMLElement>("#scenario-detail-resizer")!;
const entityMapContainer = document.querySelector<HTMLElement>("#entity-map")!;
const status = document.querySelector<HTMLElement>("#status")!;
const flowButton = document.querySelector<HTMLButtonElement>("#flow-button")!;
const flowPanel = document.querySelector<HTMLElement>("#flow-panel")!;
const flowContent = document.querySelector<HTMLElement>("#flow-content")!;
const closeFlow = document.querySelector<HTMLButtonElement>("#close-flow")!;
const locationBar = document.querySelector<HTMLElement>("#location")!;
const relatedScenarios = document.querySelector<HTMLElement>("#related-scenarios")!;
const code = document.querySelector<HTMLElement>("#code")!;
const backButton = document.querySelector<HTMLButtonElement>("#back")!;
const settingsButton = document.querySelector<HTMLButtonElement>("#settings-button")!;
const settingsPanel = document.querySelector<HTMLElement>("#settings-panel")!;
const showIntents = document.querySelector<HTMLInputElement>("#show-intents")!;
const legendButton = document.querySelector<HTMLButtonElement>("#legend-button")!;
const legendPanel = document.querySelector<HTMLElement>("#legend-panel")!;
const entityTooltip = document.querySelector<HTMLElement>("#entity-tooltip")!;
const splitter = document.querySelector<HTMLElement>("#splitter")!;
let editor: EditorView | undefined;
let entityMap: CytoscapeCore | undefined;
let selectedId: string | undefined;
let sidebarView: "entities" | "scenarios" | "entity-map" = "entities";
let currentView: { element: ElementView; inChunk: boolean } | undefined;
let chunkElements: ChunkView["elements"] = [];
let functions: CodeFunction[] = [];
let scenarios: CodeScenario[] = [];
let behaviorAreas: BehaviorArea[] = [];
let selectedScenarioId: string | undefined;
let scenarioDetailHeight = 300;
let relationships: CodeRelationship[] = [];
const backStack: Array<{ element: ElementView; inChunk: boolean }> = [];
const workspaceBase = window.location.pathname.match(/^\/w\/[^/]+/)?.[0] ?? "";
const gentleHighlighting = HighlightStyle.define([
  { tag: [tags.className, tags.typeName], color: "#8eb8c5" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "#c8ad83" },
  { tag: tags.constant(tags.name), color: "#b7a4c7" },
  { tag: tags.keyword, color: "#9ba9c4" },
  { tag: tags.string, color: "#a7bd91" },
  { tag: [tags.number, tags.bool, tags.null], color: "#c3a477" },
  { tag: tags.comment, color: "#687982", fontStyle: "italic" }
]);
const toggleScaffolding = StateEffect.define<number>();
const toggleFunctionBody = StateEffect.define<number>();

class ScaffoldingWidget extends WidgetType {
  constructor(readonly index: number, readonly label: string, readonly expanded: boolean) {
    super();
  }

  eq(other: ScaffoldingWidget): boolean {
    return this.index === other.index && this.label === other.label && this.expanded === other.expanded;
  }

  toDOM(view: EditorView): HTMLElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scaffolding-toggle";
    button.textContent = `${this.expanded ? "▾" : "▸"} ${this.label}`;
    button.addEventListener("click", () => view.dispatch({ effects: toggleScaffolding.of(this.index) }));
    return button;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

class FunctionBodyWidget extends WidgetType {
  constructor(readonly from: number, readonly lineCount: number, readonly expanded: boolean) {
    super();
  }

  eq(other: FunctionBodyWidget): boolean {
    return this.from === other.from && this.lineCount === other.lineCount && this.expanded === other.expanded;
  }

  toDOM(view: EditorView): HTMLElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "function-body-toggle";
    button.textContent = this.expanded ? "▾ body" : `{ … ${this.lineCount} lines }`;
    button.title = this.expanded ? "Collapse function body" : "Expand function body";
    button.addEventListener("click", () => view.dispatch({ effects: toggleFunctionBody.of(this.from) }));
    return button;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

class SegmentIntentWidget extends WidgetType {
  constructor(readonly number: number, readonly change: SegmentChange, readonly intent: string, readonly continued: boolean) {
    super();
  }

  eq(other: SegmentIntentWidget): boolean {
    return this.number === other.number && this.change === other.change && this.intent === other.intent && this.continued === other.continued;
  }

  toDOM(): HTMLElement {
    const annotation = document.createElement("div");
    annotation.className = `segment-intent segment-accent-${(this.number - 1) % 3}`;
    const badge = document.createElement("span");
    badge.className = "segment-badge";
    badge.textContent = String(this.number);
    annotation.append(badge);
    const change = document.createElement("span");
    change.className = `segment-change change-${this.change}`;
    change.textContent = this.change.toUpperCase();
    annotation.append(change);
    if (this.continued) {
      annotation.classList.add("segment-continuation");
      const continued = document.createElement("span");
      continued.className = "continuation-label";
      continued.textContent = "continued";
      annotation.append(continued);
    } else {
      const text = document.createElement("span");
      text.className = "intent-text";
      text.textContent = this.intent;
      annotation.append(text);
    }
    return annotation;
  }
}

await loadPresentation();
const events = new EventSource(apiPath("/api/events"));
events.addEventListener("presentation", () => void loadPresentation());
events.addEventListener("error", () => void loadPresentation());
document.querySelectorAll<HTMLButtonElement>("#view-tabs button").forEach((button) => {
  button.addEventListener("click", () => setSidebarView(button.dataset.view as "entities" | "scenarios" | "entity-map"));
});
backButton.addEventListener("click", goBack);
settingsButton.addEventListener("click", toggleSettings);
showIntents.addEventListener("change", updateIntentVisibility);
flowButton.addEventListener("click", () => setFlowOpen(flowPanel.hidden));
closeFlow.addEventListener("click", () => setFlowOpen(false));
scenarioDetailToggle.addEventListener("click", toggleScenarioDetail);
scenarioDetailResizer.addEventListener("pointerdown", beginScenarioDetailResize);
scenarioDetailResizer.addEventListener("pointermove", continueScenarioDetailResize);
scenarioDetailResizer.addEventListener("pointerup", endScenarioDetailResize);
legendButton.addEventListener("click", toggleLegend);
document.addEventListener("pointerdown", closePanelsOutside);
document.addEventListener("keydown", closePanelsWithKeyboard);
splitter.addEventListener("pointerdown", beginResize);
splitter.addEventListener("pointermove", continueResize);
splitter.addEventListener("pointerup", endResize);
splitter.addEventListener("keydown", resizeWithKeyboard);

async function loadPresentation(): Promise<void> {
  const response = await fetch(apiPath("/api/presentation"));
  const payload = await response.json() as { presentation?: ChunkView; error?: string };
  if (payload.error) status.textContent = payload.error;
  if (!payload.presentation) return;

  title.textContent = payload.presentation.label;
  chunkElements = payload.presentation.elements;
  functions = payload.presentation.functions.filter((fn) => !isConstructor(fn));
  scenarios = payload.presentation.scenarios;
  behaviorAreas = payload.presentation.behaviorAreas;
  selectedScenarioId = scenarios.some((scenario) => scenario.id === selectedScenarioId)
    ? selectedScenarioId
    : scenarios[0]?.id;
  relationships = payload.presentation.relationships;
  status.textContent = `${chunkElements.length} entities · ${scenarios.length} scenarios`;
  elements.replaceChildren(createBlockTree());
  renderScenarioHierarchy();
  renderEntityMap();
  const nextId = chunkElements.some((element) => element.id === selectedId)
    ? selectedId!
    : chunkElements[0]?.id;
  if (nextId) await showElement(nextId);
}

function createScenarioCatalog(): DocumentFragment {
  const fragment = document.createDocumentFragment();
  if (behaviorAreas.length === 0) {
    fragment.append(...scenarios.map(createScenarioTreeItem));
    return fragment;
  }
  behaviorAreas.forEach((area, areaIndex) => {
    const areaSection = document.createElement("details");
    areaSection.className = "scenario-area-tree";
    const containsSelection = area.capabilities.some((capability) => capability.scenarioIds.includes(selectedScenarioId ?? ""));
    areaSection.open = containsSelection || (selectedScenarioId === undefined && areaIndex === 0);
    const areaHeading = document.createElement("summary");
    const areaTitle = document.createElement("strong");
    areaTitle.textContent = area.title;
    const areaCount = document.createElement("span");
    areaCount.textContent = String(area.capabilities.reduce((total, capability) => total + capability.scenarioIds.length, 0));
    areaHeading.append(areaTitle, areaCount);
    areaSection.append(areaHeading);
    if (area.description) {
      const description = document.createElement("p");
      description.textContent = area.description;
      areaSection.append(description);
    }
    for (const capability of area.capabilities) {
      const capabilitySection = document.createElement("details");
      capabilitySection.className = "scenario-capability-card";
      capabilitySection.open = capability.scenarioIds.includes(selectedScenarioId ?? "");
      const heading = document.createElement("summary");
      const capabilityTitle = document.createElement("strong");
      capabilityTitle.textContent = capability.title;
      const capabilityCount = document.createElement("span");
      capabilityCount.textContent = String(capability.scenarioIds.length);
      heading.append(capabilityTitle, capabilityCount);
      const promise = document.createElement("p");
      promise.textContent = capability.promise;
      capabilitySection.append(heading, promise);
      for (const scenarioId of capability.scenarioIds) {
        const scenario = scenarios.find((candidate) => candidate.id === scenarioId);
        if (scenario) capabilitySection.append(createScenarioTreeItem(scenario));
      }
      areaSection.append(capabilitySection);
    }
    fragment.append(areaSection);
  });
  return fragment;
}

function createScenarioTreeItem(scenario: CodeScenario): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "scenario-tree-item";
  button.dataset.scenarioId = scenario.id;
  button.classList.toggle("selected", scenario.id === selectedScenarioId);
  const marker = document.createElement("span");
  marker.className = "scenario-tree-marker";
  marker.textContent = "●";
  const title = document.createElement("strong");
  title.textContent = scenario.title;
  const coverageCount = document.createElement("span");
  coverageCount.className = "scenario-tree-coverage";
  const count = scenario.coverageCases?.length ?? 0;
  coverageCount.textContent = count === 0 ? "" : String(count);
  coverageCount.title = count === 0 ? "" : `${count} coverage case${count === 1 ? "" : "s"}`;
  button.append(marker, title);
  if (count > 0) {
    coverageCount.textContent = `${count} cov`;
    button.append(coverageCount);
  }
  button.addEventListener("click", () => openScenario(scenario.id));
  return button;
}

function renderScenarioHierarchy(): void {
  scenarioList.replaceChildren(createScenarioCatalog());
  renderScenarioDetail();
}

function renderScenarioDetail(): void {
  const scenario = scenarios.find((candidate) => candidate.id === selectedScenarioId);
  scenarioDetail.replaceChildren(...(scenario ? [createScenarioCard(scenario)] : []));
}

function isConstructor(fn: CodeFunction): boolean {
  const owner = chunkElements.find((block) => block.id === fn.ownerBlockId);
  return owner !== undefined && focusedSymbol(fn.symbol) === focusedSymbol(owner.symbol);
}

function createBlockTree(): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const roots = chunkElements.filter((block) => block.parentId === undefined);
  roots.forEach((root) => fragment.append(createBlockNode(root, 0)));
  return fragment;
}

function createBlockNode(block: ChunkView["elements"][number], depth: number): HTMLElement {
  const node = document.createElement("div");
  node.className = "block-node";
  node.dataset.depth = String(depth);
  const row = document.createElement("div");
  row.className = "block-row";
  const children = chunkElements.filter((candidate) => candidate.parentId === block.id);
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "block-toggle";
  toggle.textContent = children.length === 0 ? "" : "▾";
  toggle.disabled = children.length === 0;
  toggle.setAttribute("aria-label", children.length === 0 ? "No contained entities" : `Collapse ${block.symbol}`);
  const blockButton = createElementButton(block);
  blockButton.classList.add("block-button");
  row.append(toggle, blockButton);
  node.append(row);
  if (block.id === selectedId) {
    const ownedFunctions = functions.filter((fn) => fn.ownerBlockId === block.id);
    if (ownedFunctions.length > 0) node.append(createFunctionDrawer(ownedFunctions));
  }
  if (children.length > 0) {
    const branch = document.createElement("div");
    branch.className = "block-children";
    children.forEach((child) => branch.append(createBlockNode(child, depth + 1)));
    toggle.addEventListener("click", () => {
      branch.hidden = !branch.hidden;
      toggle.textContent = branch.hidden ? "▸" : "▾";
      toggle.setAttribute("aria-label", `${branch.hidden ? "Expand" : "Collapse"} ${block.symbol}`);
    });
    node.append(branch);
  }
  return node;
}

function createFunctionDrawer(ownedFunctions: CodeFunction[]): HTMLDetailsElement {
  const drawer = document.createElement("details");
  drawer.className = "block-functions";
  const heading = document.createElement("summary");
  heading.className = "block-functions-heading";
  heading.textContent = `Functions (${ownedFunctions.length})`;
  const content = document.createElement("div");
  content.className = "block-functions-content";
  drawer.append(heading);
  drawer.addEventListener("toggle", () => {
    if (drawer.open) ensureFunctionDrawerWidth(drawer);
  });
  for (const fn of ownedFunctions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "block-function";
    const name = document.createElement("code");
    name.textContent = focusedSymbol(fn.symbol);
    const markers = document.createElement("span");
    markers.className = "review-markers function-type-markers";
    markers.setAttribute("aria-label", `Code types: ${(fn.codeTypes ?? []).map(reviewKindLabel).join(", ")}`);
    markers.innerHTML = (fn.codeTypes ?? []).map(reviewMarker).join("");
    button.append(name, markers);
    const description = fn.role ?? "No description available.";
    button.setAttribute("aria-describedby", "entity-tooltip");
    button.addEventListener("pointerenter", () => showEntityTooltip(button, description));
    button.addEventListener("pointerleave", hideEntityTooltip);
    button.addEventListener("focus", () => showEntityTooltip(button, description));
    button.addEventListener("blur", hideEntityTooltip);
    button.addEventListener("click", () => void showFunction(fn));
    content.append(button);
  }
  drawer.append(content);
  return drawer;
}

function ensureFunctionDrawerWidth(drawer: HTMLElement): void {
  const current = Number.parseFloat(getComputedStyle(app).getPropertyValue("--sidebar-width")) || 280;
  const maximum = Math.min(480, window.innerWidth - 320);
  setSidebarWidth(sidebarWidthForFunctionDrawer(current, drawer.getBoundingClientRect().width, maximum));
}

async function showFunction(fn: CodeFunction): Promise<void> {
  await showTarget({ kind: "function", symbol: fn.symbol, path: fn.path });
}

function setSidebarView(view: "entities" | "scenarios" | "entity-map"): void {
  sidebarView = view;
  entityView.hidden = view !== "entities";
  scenarioView.hidden = view !== "scenarios";
  entityMapContainer.hidden = view !== "entity-map";
  document.querySelectorAll<HTMLButtonElement>("#view-tabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  if (view === "entity-map") {
    requestAnimationFrame(() => {
      entityMap?.resize();
      entityMap?.fit(undefined, 24);
    });
  }
}

function renderEntityMap(): void {
  entityMap?.destroy();
  const roots = chunkElements.filter((block) => block.parentId === undefined).map((block) => block.id);
  entityMap = cytoscape({
    container: entityMapContainer,
    elements: [
      ...chunkElements.map((block) => ({
        group: "nodes" as const,
        data: { id: block.id, label: focusedSymbol(block.symbol), role: block.role ?? "" }
      })),
      ...chunkElements.filter((block) => block.parentId !== undefined).map((block) => ({
        group: "edges" as const,
        data: { id: `contains:${block.parentId}:${block.id}`, source: block.parentId!, target: block.id }
      }))
    ],
    style: [
      {
        selector: "node",
        style: {
          "background-color": "#1c2928",
          "border-color": "#456f66",
          "border-width": 1,
          color: "#cdd8dc",
          label: "data(label)",
          "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
          "font-size": 10,
          "text-wrap": "ellipsis",
          "text-max-width": "110px",
          width: 116,
          height: 34
        }
      },
      {
        selector: "node:selected",
        style: {
          "background-color": "#25433d",
          "border-color": "#73c7b0",
          "border-width": 2,
          color: "#eef5f3"
        }
      },
      {
        selector: "edge",
        style: {
          "curve-style": "taxi",
          "taxi-direction": "downward",
          "line-color": "#3b4a50",
          "target-arrow-color": "#3b4a50",
          "target-arrow-shape": "triangle",
          width: 1
        }
      }
    ],
    layout: {
      name: "breadthfirst",
      directed: true,
      roots,
      spacingFactor: 1.2,
      padding: 24
    },
    minZoom: 0.25,
    maxZoom: 2.5,
    wheelSensitivity: 0.2
  });
  entityMap.on("tap", "node", (event) => void showElement(event.target.id()));
  selectEntityMapNode(selectedId);
}

function selectEntityMapNode(id: string | undefined): void {
  if (!entityMap) return;
  entityMap.$(":selected").unselect();
  if (!id) return;
  const node = entityMap.getElementById(id);
  if (node.nonempty()) node.select();
}

function createScenarioCard(scenario: CodeScenario): HTMLElement {
  const section = document.createElement("section");
  section.className = "scenario-card";
  section.dataset.scenarioId = scenario.id;
  const heading = document.createElement("h2");
  heading.textContent = scenario.title;
  const selector = document.createElement("select");
  selector.className = "scenario-projection-select";
  selector.setAttribute("aria-label", `View for ${scenario.title}`);
  selector.append(
    new Option("Basic", "basic"),
    new Option("Nested", "nested"),
    new Option("Sequence", "sequence")
  );
  const behavior = document.createElement("p");
  behavior.textContent = `${scenario.actor}: ${scenario.action} → ${scenario.result}`;
  const projection = document.createElement("div");
  projection.className = "scenario-projection";
  const renderProjection = (): void => {
    if (selector.value === "sequence") ensureScenarioDiagramWidth();
    projection.replaceChildren(createScenarioProjection(scenario, selector.value as "basic" | "nested" | "sequence"));
  };
  selector.addEventListener("change", renderProjection);
  section.append(heading, selector, behavior, projection);
  const specificationTests = scenario.evidence.filter(isTestEvidence);
  const coverageCases = (scenario.coverageCases ?? []).filter((item) => item.evidence.some(isTestEvidence));
  if (specificationTests.length > 0 || coverageCases.length > 0) {
    const tests = document.createElement("details");
    tests.className = "scenario-tests";
    const summary = document.createElement("summary");
    const testCount = specificationTests.length
      + coverageCases.reduce((count, item) => count + item.evidence.filter(isTestEvidence).length, 0);
    summary.textContent = `Tests (${testCount})`;
    if (specificationTests.length > 0) {
      tests.append(createEvidenceGroup("Specification tests", specificationTests));
    }
    if (coverageCases.length > 0) {
      const coverageGroup = document.createElement("section");
      coverageGroup.className = "scenario-test-group";
      const heading = document.createElement("h3");
      heading.textContent = "Coverage cases";
      coverageGroup.append(heading);
      for (const item of coverageCases) {
        const caseHeading = document.createElement("p");
        caseHeading.className = "scenario-coverage-title";
        caseHeading.textContent = item.title;
        coverageGroup.append(caseHeading, createEvidenceList(item.evidence.filter(isTestEvidence)));
      }
      tests.append(coverageGroup);
    }
    tests.prepend(summary);
    section.append(tests);
  }
  renderProjection();
  return section;
}

function isTestEvidence(evidence: ScenarioEvidence): boolean {
  return evidence.path === "test" || evidence.path.startsWith("test/");
}

function createEvidenceGroup(title: string, evidence: ScenarioEvidence[]): HTMLElement {
  const group = document.createElement("section");
  group.className = "scenario-test-group";
  const heading = document.createElement("h3");
  heading.textContent = title;
  group.append(heading, createEvidenceList(evidence));
  return group;
}

function createEvidenceList(evidence: ScenarioEvidence[]): HTMLUListElement {
  const list = document.createElement("ul");
  list.className = "scenario-test-list";
  for (const item of evidence) {
    const row = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.label;
    button.title = `${item.path}:${item.line}`;
    button.addEventListener("click", () => void showEvidenceSource(item));
    const location = document.createElement("span");
    location.textContent = `${item.path}:${item.line}`;
    row.append(button, location);
    list.append(row);
  }
  return list;
}

async function showEvidenceSource(evidence: ScenarioEvidence): Promise<void> {
  const query = new URLSearchParams({ kind: "function", symbol: evidence.label, path: evidence.path });
  const response = await fetch(apiPath(`/api/target?${query}`));
  if (!response.ok) return;
  if (currentView) backStack.push(currentView);
  const source = await response.json() as ElementView;
  renderElement({
    ...source,
    id: `evidence:${evidence.path}:${evidence.line}:${evidence.label}`,
    symbol: evidence.label,
    focus: [{ startLine: evidence.line, endLine: evidence.line }]
  }, false);
}

function ensureScenarioDiagramWidth(): void {
  const current = Number.parseFloat(getComputedStyle(app).getPropertyValue("--sidebar-width")) || 280;
  if (current < 440) setSidebarWidth(440);
}

function createScenarioProjection(
  scenario: CodeScenario,
  mode: "basic" | "nested" | "sequence"
): HTMLElement | SVGSVGElement {
  if (mode === "nested") return createNestedScenarioView(scenario);
  if (mode === "sequence") return createSequenceDiagram(scenario);
  const container = document.createElement("div");
  container.className = "scenario-basic-sequence";
  const steps = resolveScenarioSteps(scenario, functions);
  aggregateScenarioEntities(steps).forEach(({ blockId, functions: ownedFunctions }, index) => {
    const row = document.createElement("div");
    row.className = "scenario-basic-row";
    const number = document.createElement("span");
    number.className = "scenario-basic-number";
    number.textContent = String(index + 1);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scenario-function-call";
    const owner = chunkElements.find((block) => block.id === blockId);
    const firstName = focusedSymbol(ownedFunctions[0]!.symbol);
    button.textContent = `${focusedSymbol(owner?.symbol ?? blockId)}.${firstName}()`;
    if (ownedFunctions.length > 1) {
      const count = document.createElement("span");
      count.className = "scenario-call-count";
      count.textContent = `+${ownedFunctions.length - 1} funcs`;
      button.append(count);
    }
    button.title = ownedFunctions.map(functionDisplayName).join("\n");
    button.addEventListener("click", () => void showElement(blockId));
    row.append(number, button);
    container.append(row);
  });
  return container;
}

function createNestedScenarioView(scenario: CodeScenario): HTMLElement {
  const root = document.createElement("div");
  root.className = "scenario-nested-sequence";
  const byId = new Map(functions.map((fn) => [fn.id, fn]));
  const append = (steps: ReturnType<typeof scenarioSteps>, prefix: number[], parent: HTMLElement): void => {
    steps.forEach((step, index) => {
      const fn = byId.get(step.functionId);
      if (!fn) return;
      const path = [...prefix, index + 1];
      const row = document.createElement("div");
      row.className = "scenario-nested-row";
      row.style.setProperty("--scenario-depth", String(prefix.length));
      const number = document.createElement("span");
      number.className = "scenario-step-number";
      number.textContent = path.join(".");
      row.append(number, createScenarioFunctionButton(fn));
      parent.append(row);
      append(step.children ?? [], path, parent);
    });
  };
  append(scenarioSteps(scenario), [], root);
  return root;
}

function createScenarioFunctionButton(fn: CodeFunction): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "scenario-function-call";
  button.textContent = functionDisplayName(fn);
  button.addEventListener("click", () => void showFunction(fn));
  return button;
}

function functionDisplayName(fn: CodeFunction): string {
  const owner = chunkElements.find((block) => block.id === fn.ownerBlockId);
  return `${focusedSymbol(owner?.symbol ?? fn.ownerBlockId)}.${focusedSymbol(fn.symbol)}()`;
}

function createSequenceDiagram(scenario: CodeScenario): SVGSVGElement {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.classList.add("scenario-sequence-diagram");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${scenario.title} sequence diagram`);
  const steps = resolveScenarioSteps(scenario, functions);
  const entityLaneIds = scenarioLaneIds(steps);
  const lanes = ["__actor__", ...entityLaneIds];
  const laneWidth = 140;
  const width = Math.max(300, lanes.length * laneWidth);
  const height = Math.max(160, 90 + steps.length * 50);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));

  const defs = document.createElementNS(namespace, "defs");
  const marker = document.createElementNS(namespace, "marker");
  const markerId = `arrow-${scenario.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  marker.setAttribute("id", markerId);
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "9");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "6");
  marker.setAttribute("markerHeight", "6");
  marker.setAttribute("orient", "auto-start-reverse");
  const arrowPath = document.createElementNS(namespace, "path");
  arrowPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  arrowPath.setAttribute("class", "sequence-arrow-head");
  marker.append(arrowPath);
  defs.append(marker);
  svg.append(defs);

  const laneX = new Map<string, number>();
  lanes.forEach((lane, index) => {
    const x = index * laneWidth + laneWidth / 2;
    laneX.set(lane, x);
    const label = document.createElementNS(namespace, "text");
    label.setAttribute("x", String(x));
    label.setAttribute("y", "15");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "sequence-lane-label");
    const laneLabel = lane === "__actor__"
      ? scenario.actor
      : focusedSymbol(chunkElements.find((block) => block.id === lane)?.symbol ?? lane);
    appendSvgTextLines(label, laneLabel, x);
    if (lane !== "__actor__") {
      label.classList.add("interactive");
      label.addEventListener("click", () => void showElement(lane));
    }
    const lifeline = document.createElementNS(namespace, "line");
    lifeline.setAttribute("x1", String(x));
    lifeline.setAttribute("x2", String(x));
    lifeline.setAttribute("y1", "55");
    lifeline.setAttribute("y2", String(height - 12));
    lifeline.setAttribute("class", "sequence-lifeline");
    svg.append(label, lifeline);
  });

  steps.forEach((step, index) => {
    const fromLane = step.callerBlockId ?? "__actor__";
    const toLane = step.function.ownerBlockId;
    const fromX = laneX.get(fromLane) ?? laneX.get("__actor__")!;
    const toX = laneX.get(toLane) ?? fromX;
    const y = 76 + index * 50;
    const call = document.createElementNS(namespace, "g");
    call.setAttribute("class", "sequence-call interactive");
    call.addEventListener("click", () => void showFunction(step.function));
    if (fromX === toX) {
      const loop = document.createElementNS(namespace, "path");
      loop.setAttribute("d", `M ${fromX} ${y} C ${fromX + 58} ${y} ${fromX + 58} ${y + 28} ${fromX} ${y + 28}`);
      loop.setAttribute("class", "sequence-call-line");
      loop.setAttribute("marker-end", `url(#${markerId})`);
      call.append(loop);
    } else {
      const line = document.createElementNS(namespace, "line");
      line.setAttribute("x1", String(fromX));
      line.setAttribute("x2", String(toX));
      line.setAttribute("y1", String(y));
      line.setAttribute("y2", String(y));
      line.setAttribute("class", "sequence-call-line");
      line.setAttribute("marker-end", `url(#${markerId})`);
      call.append(line);
    }
    const text = document.createElementNS(namespace, "text");
    const labelX = fromX === toX ? fromX + 30 : (fromX + toX) / 2;
    text.setAttribute("x", String(labelX));
    text.setAttribute("y", String(y - 7));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "sequence-call-label");
    text.textContent = focusedSymbol(step.function.symbol) + "()";
    call.append(text);
    svg.append(call);
  });
  return svg;
}

function appendSvgTextLines(text: SVGTextElement, label: string, x: number): void {
  const chunks = label.match(/.{1,18}/g) ?? [label];
  chunks.forEach((chunk, index) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    line.setAttribute("x", String(x));
    line.setAttribute("dy", index === 0 ? "0" : "12");
    line.textContent = chunk;
    text.append(line);
  });
  const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
  title.textContent = label;
  text.append(title);
}

function createElementButton(element: ChunkView["elements"][number]): HTMLButtonElement {
  const presentation = elementPresentation(element);
  const kinds = reviewKinds(element);
  const kindLabels = kinds.map(reviewKindLabel).join(", ");
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.elementId = element.id;
  button.setAttribute("aria-describedby", "entity-tooltip");
  button.setAttribute("aria-label", `${element.symbol}, ${element.role}, ${element.kind}, ${element.path}${kindLabels ? `, Code types: ${kindLabels}` : ""}`);
  button.innerHTML = `<strong>${escapeHtml(presentation.name)}</strong><span class="element-meta"><span>${element.kind}</span><span class="review-markers" aria-hidden="true">${kinds.map(reviewMarker).join("")}</span></span><small>${escapeHtml(presentation.context)}</small>`;
  button.addEventListener("click", () => void showElement(element.id));
  const tooltipText = element.role ?? "No description available.";
  button.addEventListener("pointerenter", () => showEntityTooltip(button, tooltipText));
  button.addEventListener("pointerleave", hideEntityTooltip);
  button.addEventListener("focus", () => showEntityTooltip(button, tooltipText));
  button.addEventListener("blur", hideEntityTooltip);
  return button;
}

function showEntityTooltip(anchor: HTMLElement, text: string): void {
  entityTooltip.textContent = text;
  entityTooltip.hidden = false;
  const anchorRect = anchor.getBoundingClientRect();
  const left = Math.min(anchorRect.right + 8, window.innerWidth - entityTooltip.offsetWidth - 8);
  const top = Math.min(anchorRect.top, window.innerHeight - entityTooltip.offsetHeight - 8);
  entityTooltip.style.left = `${Math.max(8, left)}px`;
  entityTooltip.style.top = `${Math.max(8, top)}px`;
}

function hideEntityTooltip(): void {
  entityTooltip.hidden = true;
}

function updateIntentVisibility(): void {
  app.classList.toggle("intents-hidden", !showIntents.checked);
  editor?.requestMeasure();
}

function toggleSettings(): void {
  setLegendOpen(false);
  setSettingsOpen(settingsPanel.hidden);
}

function toggleLegend(): void {
  setSettingsOpen(false);
  setLegendOpen(legendPanel.hidden);
}

function closePanelsOutside(event: PointerEvent): void {
  if (!(event.target as Element).closest("#settings")) setSettingsOpen(false);
  if (!(event.target as Element).closest("#legend")) setLegendOpen(false);
}

function closePanelsWithKeyboard(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    setSettingsOpen(false);
    setLegendOpen(false);
  }
}

function setSettingsOpen(open: boolean): void {
  settingsPanel.hidden = !open;
  settingsButton.setAttribute("aria-expanded", String(open));
}

function setLegendOpen(open: boolean): void {
  legendPanel.hidden = !open;
  legendButton.setAttribute("aria-expanded", String(open));
}

function reviewKinds(element: ChunkView["elements"][number]): ReviewKind[] {
  const present = new Set(element.codeTypes ?? []);
  return reviewKindOrder.filter((kind) => present.has(kind));
}

function reviewMarker(kind: ReviewKind): string {
  const symbols: Record<ReviewKind, string> = { behavior: "●", contract: "◆", structure: "■", wiring: "⌁" };
  return `<span class="review-marker review-${kind}">${symbols[kind]}</span>`;
}

function reviewKindLabel(kind: ReviewKind): string {
  return kind[0].toUpperCase() + kind.slice(1);
}

function setFlowOpen(open: boolean): void {
  flowPanel.hidden = !open;
  flowButton.setAttribute("aria-expanded", String(open));
}

interface FlowGroup {
  title: string;
  relationships: CodeRelationship[];
  other: "from" | "to";
}

function renderFlow(element: ElementView): void {
  const groups = flowGroups(element).filter((group) => group.relationships.length > 0);
  if (groups.length === 0) {
    const empty = document.createElement("p");
    empty.className = "flow-empty";
    empty.textContent = "No flow relationships in this slice.";
    flowContent.replaceChildren(empty);
    return;
  }
  flowContent.replaceChildren(...groups.map(createFlowGroup));
}

function flowGroups(element: ElementView): FlowGroup[] {
  if (element.kind === "field") {
    return [
      { title: "Read by", relationships: relationships.filter((edge) => edge.kind === "reads" && sameSymbol(edge.to, element)), other: "from" },
      { title: "Written by", relationships: relationships.filter((edge) => edge.kind === "writes" && sameSymbol(edge.to, element)), other: "from" }
    ];
  }
  if (element.kind !== "function") return [];
  return [
    { title: "Called by", relationships: relationships.filter((edge) => edge.kind === "calls" && sameSymbol(edge.to, element)), other: "from" },
    { title: "Calls in slice", relationships: relationships.filter((edge) => edge.kind === "calls" && sameSymbol(edge.from, element) && isChunkSymbol(edge.to)), other: "to" },
    { title: "Reads", relationships: relationships.filter((edge) => edge.kind === "reads" && sameSymbol(edge.from, element)), other: "to" },
    { title: "Writes", relationships: relationships.filter((edge) => edge.kind === "writes" && sameSymbol(edge.from, element)), other: "to" }
  ];
}

function createFlowGroup(group: FlowGroup): HTMLElement {
  const section = document.createElement("section");
  const heading = document.createElement("h2");
  heading.textContent = group.title;
  section.append(heading);
  for (const relationship of group.relationships) {
    const other = relationship[group.other];
    for (const site of relationship.sites) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "flow-relation";
      const name = document.createElement("strong");
      name.textContent = focusedSymbol(other.symbol);
      const context = document.createElement("small");
      const scope = isChunkSymbol(other) ? "" : " · outside slice";
      const certainty = relationship.certainty === "possible" ? " · possible" : "";
      context.textContent = `${site.path}:${site.line}${scope}${certainty}`;
      button.append(name, context);
      button.addEventListener("click", () => void showRelationshipSite(relationship, site));
      section.append(button);
    }
  }
  return section;
}

function sameSymbol(left: ReferenceTarget, right: ReferenceTarget): boolean {
  return left.kind === right.kind && left.symbol === right.symbol && left.path === right.path;
}

function isChunkSymbol(symbol: ReferenceTarget): boolean {
  return chunkElements.some((element) => sameSymbol(symbol, element));
}

async function showRelationshipSite(relationship: CodeRelationship, site: RelationshipSite): Promise<void> {
  const query = new URLSearchParams({
    kind: relationship.from.kind,
    symbol: relationship.from.symbol,
    path: relationship.from.path
  });
  const response = await fetch(apiPath(`/api/target?${query}`));
  if (!response.ok) return;
  if (currentView) backStack.push(currentView);
  const source = await response.json() as ElementView;
  renderElement({
    ...source,
    id: `relationship:${relationship.kind}:${site.path}:${site.line}`,
    segments: undefined,
    focus: [{ startLine: site.line, endLine: site.line }]
  }, false);
}

function beginResize(event: PointerEvent): void {
  splitter.setPointerCapture(event.pointerId);
  document.body.classList.add("resizing");
}

function continueResize(event: PointerEvent): void {
  if (splitter.hasPointerCapture(event.pointerId)) setSidebarWidth(event.clientX);
}

function endResize(event: PointerEvent): void {
  if (splitter.hasPointerCapture(event.pointerId)) splitter.releasePointerCapture(event.pointerId);
  document.body.classList.remove("resizing");
}

function toggleScenarioDetail(): void {
  const collapsed = scenarioDetailPanel.classList.toggle("collapsed");
  scenarioDetailToggle.setAttribute("aria-expanded", String(!collapsed));
  scenarioDetailToggle.textContent = `Selected Scenario ${collapsed ? "▴" : "▾"}`;
  scenarioDetailResizer.hidden = collapsed;
}

function beginScenarioDetailResize(event: PointerEvent): void {
  scenarioDetailResizer.setPointerCapture(event.pointerId);
  scenarioView.classList.add("resizing-detail");
}

function continueScenarioDetailResize(event: PointerEvent): void {
  if (!scenarioDetailResizer.hasPointerCapture(event.pointerId)) return;
  const bounds = scenarioView.getBoundingClientRect();
  const maximum = Math.max(140, bounds.height * 0.7);
  scenarioDetailHeight = Math.round(Math.max(120, Math.min(maximum, bounds.bottom - event.clientY)));
  scenarioView.style.setProperty("--scenario-detail-height", `${scenarioDetailHeight}px`);
}

function endScenarioDetailResize(event: PointerEvent): void {
  if (scenarioDetailResizer.hasPointerCapture(event.pointerId)) scenarioDetailResizer.releasePointerCapture(event.pointerId);
  scenarioView.classList.remove("resizing-detail");
}

function resizeWithKeyboard(event: KeyboardEvent): void {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const current = Number.parseFloat(getComputedStyle(app).getPropertyValue("--sidebar-width")) || 280;
  setSidebarWidth(current + (event.key === "ArrowRight" ? 16 : -16));
}

function setSidebarWidth(width: number): void {
  const bounded = Math.round(Math.max(180, Math.min(width, Math.min(480, window.innerWidth - 320))));
  app.style.setProperty("--sidebar-width", `${bounded}px`);
  splitter.setAttribute("aria-valuenow", String(bounded));
}

function elementPresentation(element: ChunkView["elements"][number]): { name: string; context: string } {
  return { name: focusedSymbol(element.symbol), context: element.path };
}

function focusedSymbol(symbol: string): string {
  const operatorSeparator = symbol.lastIndexOf("::operator");
  if (operatorSeparator >= 0) return symbol.slice(operatorSeparator + 2);

  let templateDepth = 0;
  for (let index = symbol.length - 1; index > 0; index -= 1) {
    if (symbol[index] === ">") templateDepth += 1;
    else if (symbol[index] === "<") templateDepth = Math.max(0, templateDepth - 1);
    else if (templateDepth === 0 && symbol[index] === ":" && symbol[index - 1] === ":") {
      return symbol.slice(index + 1);
    }
  }
  return symbol;
}

async function showElement(id: string): Promise<void> {
  const response = await fetch(apiPath(`/api/blocks/${encodeURIComponent(id)}`));
  if (!response.ok) return;
  const element = await response.json() as ElementView;
  selectedId = id;
  elements.replaceChildren(createBlockTree());
  selectEntityMapNode(id);
  backStack.length = 0;
  renderElement(element, true);
  renderRelatedScenarios(id);
  renderEntityScenarios(id);
}

function renderEntityScenarios(blockId: string): void {
  const block = chunkElements.find((candidate) => candidate.id === blockId);
  const related = scenarios.filter((scenario) => scenario.participants.some((participant) => participant.blockId === blockId));
  entityScenariosHeading.textContent = block === undefined
    ? "Associated scenarios"
    : `Scenarios for ${focusedSymbol(block.symbol)}`;
  if (related.length === 0) {
    const empty = document.createElement("p");
    empty.className = "entity-scenarios-empty";
    empty.textContent = "No scenarios declared for this entity.";
    entityScenariosList.replaceChildren(empty);
    return;
  }
  entityScenariosList.replaceChildren(...related.map((scenario) => {
    const button = document.createElement("button");
    button.type = "button";
    const participant = scenario.participants.find((candidate) => candidate.blockId === blockId);
    const title = document.createElement("strong");
    title.textContent = scenario.title;
    const role = document.createElement("small");
    role.textContent = participant?.role ?? "participates";
    button.append(title, role);
    button.addEventListener("click", () => openScenario(scenario.id));
    return button;
  }));
}

function openScenario(scenarioId: string): void {
  selectedScenarioId = scenarioId;
  setSidebarView("scenarios");
  scenarioDetailPanel.classList.remove("collapsed");
  scenarioDetailToggle.setAttribute("aria-expanded", "true");
  scenarioDetailToggle.textContent = "Selected Scenario ▾";
  scenarioDetailResizer.hidden = false;
  renderScenarioHierarchy();
  scenarioList.querySelector<HTMLElement>(`.scenario-tree-item[data-scenario-id="${CSS.escape(scenarioId)}"]`)?.scrollIntoView({ block: "nearest" });
}

function renderRelatedScenarios(blockId: string): void {
  const related = scenarios.filter((scenario) => scenario.participants.some((participant) => participant.blockId === blockId));
  relatedScenarios.replaceChildren(...related.map((scenario) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = scenario.title;
    button.addEventListener("click", () => {
      openScenario(scenario.id);
    });
    return button;
  }));
}

function renderElement(element: ElementView, inChunk: boolean): void {
  const segments = visualSegments(element);
  const focusRanges = segments.flatMap((segment) => segment.ranges);
  currentView = { element, inChunk };
  backButton.disabled = backStack.length === 0;
  locationBar.textContent = `${inChunk ? "" : "Referenced · "}${element.path} · ${element.symbol}`;
  document.querySelectorAll("#elements button").forEach((button) => {
    button.classList.toggle("selected", inChunk && (button as HTMLElement).dataset.elementId === element.id);
  });
  renderFlow(element);

  editor?.destroy();
  editor = new EditorView({
    parent: code,
    doc: element.source,
    extensions: [
      lineNumbers(),
      cpp(),
      syntaxHighlighting(gentleHighlighting),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.contentAttributes.of({ tabindex: "0", "aria-label": `${element.symbol} source` }),
      regularCodeDecorations(focusRanges),
      segmentDecorations(segments),
      focusDecorations(segments),
      functionBodyFolding(functionFocusRanges(element, focusRanges)),
      scaffoldingExtension(element.scaffolding ?? []),
      referenceDecorations(element.references),
      EditorView.domEventHandlers({
        click: (event, view) => handleReferenceClick(event, view, element.references)
      }),
      EditorView.theme({ "&": { height: "100%" }, ".cm-scroller": { overflow: "auto" } })
    ]
  });
  const firstFocus = focusRanges[0]?.startLine ?? element.display.startLine;
  const displayStart = editor.state.doc.line(clampLine(firstFocus, editor.state.doc.lines)).from;
  editor.dispatch({ effects: EditorView.scrollIntoView(displayStart, { y: "start", yMargin: 96 }) });
}

interface VisualSegment extends ReviewSegment {
  number: number;
  annotated: boolean;
}

function visualSegments(element: ElementView): VisualSegment[] {
  if (element.segments?.length) {
    return element.segments.map((segment, index) => ({ ...segment, number: index + 1, annotated: true }));
  }
  const ranges = element.focus?.length ? element.focus : [element.display];
  return [{ id: "legacy-focus", intentKind: "structure", change: "modified", intent: "", ranges, number: 1, annotated: false }];
}

function referenceDecorations(references: ReferenceHint[]) {
  return EditorView.decorations.compute([], (state) => {
    const builder = new RangeSetBuilder<Decoration>();
    const positions = references
      .map((reference) => ({ reference, from: referenceOffset(state, reference) }))
      .sort((left, right) => left.from - right.from);
    for (const { reference, from } of positions) {
      const length = referenceLength(reference);
      const local = "target" in reference;
      builder.add(from, Math.min(from + length, state.doc.length), Decoration.mark({
        class: `${local ? "code-reference" : "code-origin"} symbol-${referenceRole(reference)}`,
        attributes: { title: local ? `Open ${reference.target.symbol}` : reference.origin }
      }));
    }
    return builder.finish();
  });
}

function handleReferenceClick(event: MouseEvent, view: EditorView, references: ReferenceHint[]): boolean {
  const offset = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (offset === null) return false;
  const reference = references.find((candidate) => {
    const from = referenceOffset(view.state, candidate);
    return offset >= from && offset <= from + referenceLength(candidate);
  });
  if (!reference || !("target" in reference)) return false;
  void showTarget(reference.target);
  return true;
}

async function showTarget(target: ReferenceTarget): Promise<void> {
  const query = new URLSearchParams({ kind: target.kind, symbol: target.symbol, path: target.path });
  const response = await fetch(apiPath(`/api/target?${query}`));
  if (!response.ok) return;
  if (currentView) backStack.push(currentView);
  renderElement(await response.json() as ElementView, false);
}

function goBack(): void {
  const previous = backStack.pop();
  if (previous) renderElement(previous.element, previous.inChunk);
}

function referenceOffset(state: EditorState, reference: ReferenceHint): number {
  const line = state.doc.line(clampLine(reference.source.line, state.doc.lines));
  return Math.min(line.to, line.from + reference.source.column - 1);
}

function referenceLength(reference: ReferenceHint): number {
  const symbol = "target" in reference ? reference.target.symbol : reference.origin;
  return reference.source.length
    ?? (symbol.split("::").at(-1) ?? symbol).length;
}

function referenceRole(reference: ReferenceHint): ReferenceRole {
  if (reference.source.role) return reference.source.role;
  if ("target" in reference && reference.target.kind === "function") return "function";
  if ("target" in reference && reference.target.kind === "field") return "field";
  return "type";
}

function focusDecorations(segments: VisualSegment[]) {
  return EditorView.decorations.compute([], (state) => {
    const builder = new RangeSetBuilder<Decoration>();
    const focusRanges = segmentRanges(segments, state.doc.lines);
    for (const { range, segment } of focusRanges) {
      const longestLine = longestLineLength(state, range);
      for (let lineNumber = range.startLine; lineNumber <= range.endLine; lineNumber += 1) {
        const classes = ["focus-line", `segment-accent-${(segment.number - 1) % 3}`];
        if (lineNumber === range.startLine) classes.push("focus-start");
        if (lineNumber === range.endLine) classes.push("focus-end");
        const line = state.doc.line(lineNumber);
        builder.add(line.from, line.from, Decoration.line({
          attributes: {
            class: classes.join(" "),
            style: `--focus-columns: ${longestLine}`
          }
        }));
      }
    }
    return builder.finish();
  });
}

function segmentDecorations(segments: VisualSegment[]) {
  return EditorView.decorations.compute([], (state) => {
    const decorations: Range<Decoration>[] = [];
    const occurrences = new Map<number, number>();
    segmentRanges(segments, state.doc.lines).forEach(({ range, segment }) => {
      const start = state.doc.line(range.startLine);
      if (segment.annotated) {
        const occurrence = occurrences.get(segment.number) ?? 0;
        decorations.push(Decoration.widget({
          widget: new SegmentIntentWidget(segment.number, segment.change, segment.intent, occurrence > 0),
          block: true,
          side: -1
        }).range(start.from));
        occurrences.set(segment.number, occurrence + 1);
      }
    });
    return Decoration.set(decorations, true);
  });
}

function segmentRanges(segments: VisualSegment[], maxLine: number): Array<{ range: SourceRange; segment: VisualSegment }> {
  return segments.flatMap((segment) => segment.ranges.map((range) => ({
    segment,
    range: {
      startLine: clampLine(range.startLine, maxLine),
      endLine: clampLine(range.endLine, maxLine)
    }
  }))).sort((left, right) => left.range.startLine - right.range.startLine);
}

function longestLineLength(state: EditorState, range: SourceRange): number {
  let longest = 1;
  for (let lineNumber = range.startLine; lineNumber <= range.endLine; lineNumber += 1) {
    longest = Math.max(longest, state.doc.line(lineNumber).text.length);
  }
  return longest;
}

function regularCodeDecorations(focusRanges: SourceRange[]) {
  return EditorView.decorations.compute([], (state) => {
    const builder = new RangeSetBuilder<Decoration>();
    const focus = mergeLineRanges(focusRanges, state.doc.lines);
    let nextLine = 1;
    for (const range of focus) {
      if (nextLine < range.startLine) addRegularRange(builder, state, nextLine, range.startLine - 1);
      nextLine = range.endLine + 1;
    }
    if (nextLine <= state.doc.lines) addRegularRange(builder, state, nextLine, state.doc.lines);
    return builder.finish();
  });
}

function mergeLineRanges(ranges: SourceRange[], maxLine: number): SourceRange[] {
  const ordered = ranges
    .map((range) => ({
      startLine: clampLine(range.startLine, maxLine),
      endLine: clampLine(range.endLine, maxLine)
    }))
    .sort((left, right) => left.startLine - right.startLine);
  const merged: SourceRange[] = [];
  for (const range of ordered) {
    const previous = merged.at(-1);
    if (!previous || range.startLine > previous.endLine + 1) merged.push({ ...range });
    else previous.endLine = Math.max(previous.endLine, range.endLine);
  }
  return merged;
}

function addRegularRange(
  builder: RangeSetBuilder<Decoration>,
  state: EditorState,
  startLine: number,
  endLine: number
): void {
  builder.add(
    state.doc.line(startLine).from,
    state.doc.line(endLine).to,
    Decoration.mark({ class: "regular-code" })
  );
}

function functionFocusRanges(element: ElementView, focusRanges: SourceRange[]): SourceRange[] {
  if (element.segments?.length || element.focus?.length) return focusRanges;
  return [element.display];
}

interface FunctionBody {
  from: number;
  to: number;
  lineCount: number;
}

interface FunctionBodyState {
  decorations: DecorationSet;
  expanded: ReadonlySet<number>;
}

function functionBodyFolding(focusRanges: SourceRange[]) {
  return StateField.define<FunctionBodyState>({
    create: (state) => ({ expanded: new Set(), decorations: buildFunctionBodies(state, focusRanges, new Set()) }),
    update: (value, transaction) => {
      const expanded = new Set(value.expanded);
      for (const effect of transaction.effects) {
        if (!effect.is(toggleFunctionBody)) continue;
        if (expanded.has(effect.value)) expanded.delete(effect.value);
        else expanded.add(effect.value);
      }
      return { expanded, decorations: buildFunctionBodies(transaction.state, focusRanges, expanded) };
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.decorations)
  });
}

function buildFunctionBodies(
  state: EditorState,
  focusRanges: SourceRange[],
  expanded: ReadonlySet<number>
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const body of nonFocusFunctionBodies(state, focusRanges)) {
    const isExpanded = expanded.has(body.from);
    const widget = new FunctionBodyWidget(body.from, body.lineCount, isExpanded);
    if (isExpanded) builder.add(body.from, body.from, Decoration.widget({ widget, side: -1 }));
    else builder.add(body.from, body.to, Decoration.replace({ widget }));
  }
  return builder.finish();
}

function nonFocusFunctionBodies(state: EditorState, focusRanges: SourceRange[]): FunctionBody[] {
  const focus = mergeLineRanges(focusRanges, state.doc.lines);
  const bodies: FunctionBody[] = [];
  const cursor = syntaxTree(state).cursor();
  do {
    if (cursor.name !== "FunctionDefinition") continue;
    const functionStart = state.doc.lineAt(cursor.from).number;
    const functionEnd = state.doc.lineAt(Math.max(cursor.from, cursor.to - 1)).number;
    if (focus.some((range) => range.startLine <= functionEnd && functionStart <= range.endLine)) continue;

    const body = cursor.node.getChild("CompoundStatement");
    if (!body) continue;
    const bodyStart = state.doc.lineAt(body.from).number;
    const bodyEnd = state.doc.lineAt(Math.max(body.from, body.to - 1)).number;
    if (bodyEnd <= bodyStart) continue;
    bodies.push({ from: body.from, to: body.to, lineCount: bodyEnd - bodyStart + 1 });
  } while (cursor.next());
  return bodies;
}

interface ScaffoldingState {
  decorations: DecorationSet;
  expanded: ReadonlySet<number>;
}

function scaffoldingExtension(regions: ScaffoldingRegion[]) {
  const ordered = [...regions].sort((left, right) => left.startLine - right.startLine);
  return StateField.define<ScaffoldingState>({
    create: (state) => ({ expanded: new Set(), decorations: buildScaffolding(state, ordered, new Set()) }),
    update: (value, transaction) => {
      const expanded = new Set(value.expanded);
      for (const effect of transaction.effects) {
        if (!effect.is(toggleScaffolding)) continue;
        if (expanded.has(effect.value)) expanded.delete(effect.value);
        else expanded.add(effect.value);
      }
      return { expanded, decorations: buildScaffolding(transaction.state, ordered, expanded) };
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.decorations)
  });
}

function buildScaffolding(
  state: EditorState,
  regions: ScaffoldingRegion[],
  expanded: ReadonlySet<number>
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  regions.forEach((region, index) => {
    const startLine = state.doc.line(clampLine(region.startLine, state.doc.lines));
    const endLine = state.doc.line(clampLine(region.endLine, state.doc.lines));
    const widget = new ScaffoldingWidget(index, region.label, expanded.has(index));
    if (expanded.has(index)) {
      builder.add(startLine.from, startLine.from, Decoration.widget({ widget, block: true, side: -1 }));
    } else {
      builder.add(startLine.from, endLine.to, Decoration.replace({ widget, block: true }));
    }
  });
  return builder.finish();
}

function clampLine(line: number, maxLine: number): number {
  return Math.max(1, Math.min(line, maxLine));
}

function escapeHtml(value: string): string {
  const span = document.createElement("span");
  span.textContent = value;
  return span.innerHTML;
}

function apiPath(path: string): string {
  return `${workspaceBase}${path}`;
}
