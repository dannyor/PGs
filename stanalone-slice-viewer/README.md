# Codex Code Viewer

A lean, read-only C++ code viewer designed around interaction with Codex.

It is a purpose-built review surface for code slices curated by Codex. It makes Codex's work fast to inspect in its surrounding code: more navigable than Codex's basic source display, but without the editing, build, diagnostics, and project-management concerns of an IDE.

## Product Principles

- Codex curates the code slice; the human explores from it.
- The viewer is read-only and anchored to the active slice.
- Navigation remains useful when the project is incomplete or does not compile.
- Resulting code is primary; diff viewing is not.
- One local viewer serves all registered workspaces.
- Files and references are loaded lazily because a slice is small even when its workspace is large.

## Core Concepts

### Slice

A slice is a Codex-managed collection of semantic code elements. It may span several locations, classes, and files.

Codex alone changes slice membership. Following a reference outside the slice does not add its target to the slice.

### Element

An element is a navigable context such as a class, struct, enum, function, or method. Selecting it opens the surrounding source.

### Review segment

A segment is the unit of review within an element. It declares one Codex-written intent, classifies that intent as behavior, contract, structure, or wiring, records whether the reviewed concept is new or modified, and identifies one or more precise source ranges that implement it.

The whole element is not automatically focus code. For example, when two lines matter inside a 30-line function, only those lines belong to the segment; the rest of the function remains regular context. Separated ranges may share one segment when they jointly implement the same intent. Different intents require different segments.

### Code roles

Every displayed file distinguishes:

- **Slice focus:** the precise ranges belonging to review segments.
- **Regular code:** surrounding context that remains visible and navigable.
- **Scaffolding:** incidental ranges, such as include blocks and namespace wrappers, explicitly labeled by Codex and collapsed initially.

Focus and scaffolding ranges must not overlap.

### References

References in the code view are navigable whether or not their targets belong to the slice. The viewer resolves common C++ symbols lazily and accepts exact hints from Codex when a target is ambiguous. Symbols unavailable in workspace files may instead carry a tooltip-only fully qualified origin, such as `std::optional`.

The viewer supports classes, structs, enums, functions, methods, constructors, data-member fields, and explicit function references. It does not target local variables, macros, namespaces, or includes.

### Flow relationships

Flow is modeled as directed relationships with precise occurrence sites:

- `calls`: function to function;
- `reads`: function to field;
- `writes`: function to field.

Incoming and outgoing views are derived from the same edges. Direct relationships are the default; ambiguous or virtual C++ flow is marked `possible`. The descriptor contains the focused flow needed for review rather than a whole-workspace call graph.

## Interaction

1. The user asks Codex to view a slice.
2. Codex writes a fresh descriptor into the workspace.
3. The local viewer updates that workspace's open page.
4. The user selects slice elements and follows references.
5. Back navigation returns through the exploration path.

Publication is on demand. The viewer does not continuously follow later source edits; another **View slice** request republishes the descriptor and source view.

Each workspace has one active slice and a stable URL at `/w/<workspace-id>`. Multiple projects may remain open in separate browser tabs without affecting one another.

## Responsibilities

### Codex

Codex:

- chooses the locations and elements in the slice;
- divides each element into precise review segments;
- writes one concise intent for every segment, emphasizing behavioral outcome, rule, invariant, or design responsibility rather than code mechanics;
- explicitly marks scaffolding ranges and supplies meaningful collapse labels;
- replaces the active slice on demand;
- supplies reference hints when viewer resolution is insufficient.
- supplies complete target-or-origin coverage for non-local symbols inside every focused segment.

### Viewer

The viewer:

- reads live source from the registered workspace;
- displays the active slice as a compact element collection;
- renders read-only, syntax-highlighted code with line numbers;
- presents each segment's intent with its focused ranges while keeping regular code available;
- collapses Codex-marked scaffolding;
- resolves references lazily and honors exact Codex hints;
- keeps out-of-slice exploration distinct from slice membership;
- maintains navigation history independently in each browser tab;
- isolates source, cache, watcher, and navigation state by workspace.

## UI Specifications

### Layout

- The page is fixed to the viewport.
- The slice pane and code pane scroll independently.
- A vertical splitter resizes the slice pane from 180px to 480px while preserving at least 320px for code.
- The splitter supports pointer dragging and keyboard Left/Right arrows.
- There is no traditional filesystem tree.

### Slice pane

- Each element uses a uniform, single-line card.
- The card shows the unqualified focused symbol and file path.
- Namespaces and enclosing scopes appear in the larger custom tooltip, accessible label, and selected-code header.
- Long symbols use ellipsis rather than wrapping.
- Entries show small color-and-shape markers for every review kind present in their segments: behavior, contract, structure, and wiring. Mixed elements show multiple markers without changing the selected-card color.
- A compact legend button at the bottom of the pane opens the marker key.
- A separate Flow control opens a collapsible inspector for the selected function or field. It groups callers, focused callees, reads, writers, and writes as appropriate.
- Selecting a Flow relation opens its precise occurrence site; normal Back navigation returns to the prior view.

### Code hierarchy

- **Slice focus:** 13px code with current semantic coloring and a thin outline. Each box ends just after its longest focus line, capped by the viewport, and has no selection-like fill.
- **Segment intent:** a gently tinted caption shown by default above the segment's first range. A numbered badge identifies the segment, and prose wraps within the available code-pane width.
- **Segment change:** every segment displays a compact `NEW` or `MODIFIED` status. The status belongs to the whole segment, repeats on continuation ranges, and remains visible when intent prose is hidden.
- A standard settings menu at the right edge of the toolbar lets the user show or hide intent captions for the current browser tab; segment focus remains visible either way. The menu is the home for future viewer preferences.
- Multiple ranges belonging to one segment share its number and accent; later ranges show a compact continuation marker.
- Different segments use subtle alternating accents so their boundaries remain discernible without strong coloring.
- Focus boxes add modest internal breathing room above and below their code. They do not insert artificial source rows, so gutter numbers remain aligned with real code lines.
- **Regular code:** 10px code with the same semantic colors at reduced prominence.
- **Non-focus function bodies:** collapsed to a compact inline marker while their signatures remain visible. They expand in place; a function selected as a slice element or reference target is shown expanded.
- **Scaffolding:** a collapsed inline disclosure with Codex's concise description, expandable in place.

### Semantic color

- Types use muted blue.
- Functions and methods use warm sand.
- Constants and enum values use soft violet.
- Keywords, strings, comments, and numbers use low-contrast supporting colors.
- Clickable references retain their semantic color and add only a dotted underline.
- External-origin symbols use a quiet dotted underline and help cursor; their tooltip shows the fully qualified origin without offering navigation.

### Gutter

- Line numbers use 9px text.
- Code and gutter rows share fixed geometry; smaller line numbers are vertically centered within it.
- The gutter differs from the editor background only by a gentle cool-teal hue and quiet divider.

### Navigation

- Clicking a reference opens its semantic target without changing slice membership.
- Each tab maintains its own exploration stack.
- A visible Back control supports repeated traversal through that stack.
- Selecting a slice element starts a fresh exploration path from it.

## Workspace Integration

The viewer is a standalone local tool:

```bash
codex-code-viewer /path/to/workspace
```

The first invocation starts one shared per-user server and registers the workspace. Later invocations discover and reuse that server, registering or reusing workspaces and returning their stable URLs.

The server prefers `127.0.0.1:4319`. It records its PID and active port in `~/.codex/run/code-viewer.json`. If another application owns 4319, it selects an available loopback port and publishes it through that runtime file. `CODEX_CODE_VIEWER_PORT` requires an explicit port and remains authoritative.

The runtime record is advisory: clients validate the discovered server before using it and safely ignore stale state. Multiple viewer servers are exceptional, not the normal operating model.

The server binds only to loopback. Requests are routed through registered workspace sessions, and file access is confined to the matching workspace root.

## Slice Descriptor

Codex publishes `.codex/code-viewer/chunk.json` in the workspace:

```json
{
  "version": 2,
  "chunk": {
    "id": "parser-error-handling",
    "label": "Parser error handling",
    "elements": [
      {
        "id": "recover",
        "kind": "function",
        "symbol": "Parser::recover",
        "path": "src/parser.cpp",
        "segments": [
          {
            "id": "reject-stale-response",
            "intentKind": "behavior",
            "change": "modified",
            "intent": "Prevent an older response from replacing newer state.",
            "ranges": [
              { "startLine": 142, "endLine": 146 }
            ]
          },
          {
            "id": "publish-current-state",
            "intentKind": "behavior",
            "change": "new",
            "intent": "Publish accepted state only after recovery succeeds.",
            "ranges": [
              { "startLine": 157, "endLine": 158 }
            ]
          }
        ],
        "scaffolding": [
          {
            "startLine": 1,
            "endLine": 8,
            "label": "Includes and namespace setup"
          }
        ]
      }
    ]
  },
  "references": [
    {
      "source": {
        "path": "src/parser.cpp",
        "line": 151,
        "column": 18,
        "length": 7,
        "role": "function"
      },
      "target": {
        "kind": "function",
        "symbol": "ErrorHandler::recover",
        "path": "src/error_handler.cpp"
      }
    },
    {
      "source": {
        "path": "src/parser.cpp",
        "line": 142,
        "column": 3,
        "length": 13,
        "role": "type"
      },
      "origin": "std::optional"
    }
  ],
  "relationships": [
    {
      "kind": "calls",
      "from": {
        "kind": "function",
        "symbol": "Parser::recover",
        "path": "src/parser.cpp"
      },
      "to": {
        "kind": "function",
        "symbol": "ErrorHandler::recover",
        "path": "src/error_handler.cpp"
      },
      "sites": [
        { "path": "src/parser.cpp", "line": 151, "column": 18 }
      ]
    }
  ]
}
```

The descriptor carries locations, review intent, and presentation structure—not copied source. Paths are workspace-relative; lines and columns are one-based.

Every version-2 element requires at least one segment. Every segment requires a unique ID, an `intentKind` (`behavior`, `contract`, `structure`, or `wiring`), semantic `change` (`new` or `modified`), a non-empty plain-text intent, and one or more non-overlapping ranges. `new` introduces a new reviewed concept; `modified` changes an existing one. The status applies to the segment, not individual lines. Segment ranges and scaffolding must not overlap. Version-1 descriptors remain readable for migration but do not satisfy the current segment contract.

Reference hints map an exact token occurrence to exactly one destination. A local `target` is clickable and navigable; field targets resolve the member's declaration within its owning class or struct. An `origin` is tooltip-only for a symbol unavailable in workspace files. Optional `source.length` handles token text that differs from the destination name; `source.role` may be `type`, `function`, `constant`, or `field`.

Relationships carry directed `calls`, `reads`, and `writes` flow. Each edge has a function `from`, a function or field `to`, and one or more occurrence sites in the source function. Flow involving ambiguity or virtual dispatch uses `certainty: "possible"`.

## Scope

Version one is C++ only and intentionally excludes:

- editing, refactoring, and formatting;
- build controls, terminals, and diagnostics;
- clangd and compilation-database integration;
- global browsing independent of the active slice;
- generated explanations or a required reading order;
- diff-first workflows.

## Success Criteria

The viewer succeeds when a user can ask Codex to present a slice for review, reach the relevant code almost immediately, understand what Codex is showing, and navigate its relationships without opening a full IDE or compiling the project.

---

## Implementation Notes — Secondary

Everything above defines the product behavior and user-facing contract. The details below are replaceable implementation choices and must not drive or override that contract.

### Current technology

- Node.js and TypeScript for the local server.
- Node's HTTP server and Server-Sent Events for browser updates.
- Vite and vanilla TypeScript for the browser application.
- CodeMirror 6 as a strictly read-only code surface.
- Tree-sitter with the C++ grammar for error-tolerant structure.
- Ripgrep for on-demand candidate-definition discovery.
- Chokidar for descriptor watching.
- Ajv for descriptor validation.
- Vitest for tests.

The viewer does not build a whole-workspace symbol index. It parses active files first, loads explicit targets directly, expands only when references are followed, and caches parsed files within their workspace session.

### Codex integration

A personal Codex skill implements **View slice**: it identifies the slice, writes and validates the descriptor, registers the workspace through the CLI, and opens or returns its stable URL.

Version one needs neither MCP nor a direct Codex API. A distributable version may package the skill and installer as a Codex plugin.

### Development

```bash
npm install
npm run build
npm start -- /path/to/workspace
```

### Open implementation questions

- Candidate limits and ambiguity rules for lazy C++ reference resolution.
- Whether obvious contiguous include blocks should eventually be inferred when Codex omits scaffolding metadata.
