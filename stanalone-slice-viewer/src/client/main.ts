import { cpp } from "@codemirror/lang-cpp";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { EditorState, RangeSetBuilder, StateEffect, StateField, type Range } from "@codemirror/state";
import { Decoration, EditorView, lineNumbers, WidgetType, type DecorationSet } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { ChunkView, CodeRelationship, ElementView, ReferenceHint, ReferenceRole, ReferenceTarget, RelationshipSite, ReviewKind, ReviewSegment, ScaffoldingRegion, SegmentChange, SourceRange } from "../shared/types";
import "./style.css";

const reviewKindOrder: ReviewKind[] = ["behavior", "contract", "structure", "wiring"];

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <aside>
    <header><p>CODEX SLICE</p><h1 id="chunk-title">Waiting for a slice</h1></header>
    <nav id="elements" aria-label="Chunk elements"></nav>
    <section id="flow-panel" aria-label="Selected symbol flow" hidden>
      <div class="flow-heading"><strong>Flow</strong><button id="close-flow" type="button" aria-label="Close flow inspector">×</button></div>
      <div id="flow-content"></div>
    </section>
    <div id="sidebar-footer">
      <p id="status" role="status">Write .codex/code-viewer/chunk.json to begin.</p>
      <button id="flow-button" type="button" aria-label="Toggle flow inspector" aria-expanded="false" aria-controls="flow-panel" title="Flow">⇄</button>
      <div id="legend">
        <button id="legend-button" type="button" aria-label="Review kinds legend" aria-expanded="false" aria-controls="legend-panel" title="Review kinds legend">▦</button>
        <div id="legend-panel" hidden>
          <strong>Review kinds</strong>
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
const status = document.querySelector<HTMLElement>("#status")!;
const flowButton = document.querySelector<HTMLButtonElement>("#flow-button")!;
const flowPanel = document.querySelector<HTMLElement>("#flow-panel")!;
const flowContent = document.querySelector<HTMLElement>("#flow-content")!;
const closeFlow = document.querySelector<HTMLButtonElement>("#close-flow")!;
const locationBar = document.querySelector<HTMLElement>("#location")!;
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
let selectedId: string | undefined;
let currentView: { element: ElementView; inChunk: boolean } | undefined;
let chunkElements: ChunkView["elements"] = [];
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

await loadChunk();
const events = new EventSource(apiPath("/api/events"));
events.addEventListener("chunk", () => void loadChunk());
events.addEventListener("error", () => void loadChunk());
backButton.addEventListener("click", goBack);
settingsButton.addEventListener("click", toggleSettings);
showIntents.addEventListener("change", updateIntentVisibility);
flowButton.addEventListener("click", () => setFlowOpen(flowPanel.hidden));
closeFlow.addEventListener("click", () => setFlowOpen(false));
legendButton.addEventListener("click", toggleLegend);
document.addEventListener("pointerdown", closePanelsOutside);
document.addEventListener("keydown", closePanelsWithKeyboard);
splitter.addEventListener("pointerdown", beginResize);
splitter.addEventListener("pointermove", continueResize);
splitter.addEventListener("pointerup", endResize);
splitter.addEventListener("keydown", resizeWithKeyboard);

async function loadChunk(): Promise<void> {
  const response = await fetch(apiPath("/api/chunk"));
  const payload = await response.json() as { chunk?: ChunkView; error?: string };
  if (payload.error) status.textContent = payload.error;
  if (!payload.chunk) return;

  title.textContent = payload.chunk.label;
  status.textContent = `${payload.chunk.elements.length} elements`;
  chunkElements = payload.chunk.elements;
  relationships = payload.chunk.relationships;
  elements.replaceChildren(...payload.chunk.elements.map(createElementButton));
  const nextId = payload.chunk.elements.some((element) => element.id === selectedId)
    ? selectedId!
    : payload.chunk.elements[0]?.id;
  if (nextId) await showElement(nextId);
}

function createElementButton(element: ChunkView["elements"][number]): HTMLButtonElement {
  const presentation = elementPresentation(element);
  const kinds = reviewKinds(element);
  const kindLabels = kinds.map(reviewKindLabel).join(", ");
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.elementId = element.id;
  button.setAttribute("aria-describedby", "entity-tooltip");
  button.setAttribute("aria-label", `${element.symbol}, ${element.kind}, ${element.path}${kindLabels ? `, ${kindLabels}` : ""}`);
  button.innerHTML = `<strong>${escapeHtml(presentation.name)}</strong><span class="element-meta"><span>${element.kind}</span><span class="review-markers" aria-hidden="true">${kinds.map(reviewMarker).join("")}</span></span><small>${escapeHtml(presentation.context)}</small>`;
  button.addEventListener("click", () => void showElement(element.id));
  const tooltipText = `${element.symbol}\n${element.path}${kindLabels ? `\nReview: ${kindLabels}` : ""}`;
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
  const present = new Set(element.segments?.map((segment) => segment.intentKind).filter(Boolean));
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
  const response = await fetch(apiPath(`/api/elements/${encodeURIComponent(id)}`));
  if (!response.ok) return;
  const element = await response.json() as ElementView;
  selectedId = id;
  backStack.length = 0;
  renderElement(element, true);
}

function renderElement(element: ElementView, inChunk: boolean): void {
  const segments = visualSegments(element);
  const focusRanges = segments.flatMap((segment) => segment.ranges);
  currentView = { element, inChunk };
  backButton.disabled = backStack.length === 0;
  locationBar.textContent = `${inChunk ? "" : "Referenced · "}${element.path} · ${element.symbol}`;
  document.querySelectorAll("nav button").forEach((button) => {
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
