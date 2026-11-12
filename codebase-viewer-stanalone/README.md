# Standalone Codex Codebase Viewer

A lean, read-only C++ code viewer through which a Codex session presents an
existing codebase using three complementary views:

- **Entities:** tangible class/struct Blocks selected by Codex, shown as a containment tree.
- **Scenarios:** observable behavior and the Blocks participating in it.
- **Entity Map:** a Cytoscape containment graph of the same Blocks.

Blocks and Scenarios are two projections of the same Codex-curated
presentation. Selecting either one leads to the actual workspace source in a
CodeMirror code surface; the metadata never replaces the code.

Selecting an Entity keeps the containment tree visible and updates an adjacent
panel with only its associated Scenarios. Opening one moves into the full
Scenarios view, preserving the direct structure-to-behavior relationship.

Each Scenario keeps its title and behavioral description while one compact
selector switches the ordered behavior among a linear `Entity.function()`
path, a nested numbered call list, and an interactive SVG sequence diagram.
Entity and Function labels in all three projections navigate to real source.
Basic renders one numbered row per involved Entity, showing its first Function
and a clear `+N funcs` count so every Entity is visible at once.

Entity Map is an additional structural projection, not a replacement. It uses
the same Block IDs and source-opening path as the hierarchical Blocks tree.
Functions and Scenarios are never promoted to map nodes.

Blocks form one containment tree with exactly one root. Every other Block has
one containing parent, and the nested navigation makes that ownership explicit.
Containment depth is shown by fixed gutter rulers: level 2 has the strongest
rail, level 3 is thin and muted, and deeper levels alternate restrained ruler
weights. Rows remain neutral and no textual hierarchy labels are inserted.

This project translates the delivery and interaction model of
`../stanalone-slice-viewer` without retaining its slice/review model.

## Runtime model

One per-user loopback server can host several registered workspaces. Each
workspace receives a stable URL, isolated source/cache/navigation state, a
watched descriptor, and Server-Sent Events for live refresh.

```text
Codex writes presentation.json
              │
              ▼
workspace watcher → loopback server → browser tab
                                      ├── Entities / Scenarios / Entity Map
                                      └── real C++ source
```

Codex is the sole curator. The viewer does not automatically discover the
codebase or decide which Blocks and Scenarios matter.

## Presentation descriptor

Codex publishes:

```text
.codex/code-viewer/presentation.json
```

The descriptor contains:

- stable Blocks with roles, workspace-relative source paths, optional focus
  ranges, one containment parent, and collapsible scaffolding;
- Scenarios stated as actor, starting state, action, and observable result;
- participant roles connecting Blocks and Scenarios in both directions;
- specification, coverage, main-code, or documentation evidence;
- optional exact reference hints and call/read/write relationships.

Functions are deliberately not Blocks. They remain navigable through clickable
code references, a selected Block's inline function drawer, Scenario function
links, and call/read/write relationships, without inflating the Blocks list.
Function drawers align with their owning Entity, use smaller type than Entity
rows, wrap complete names, and widen the sidebar only by the measured amount
needed for a readable function area, subject to preserving the code viewport.

Each Block popup shows its short Codex-authored description. The description is
prepared during publication from authoritative project documentation when
available, then nearby code comments, then restrained Codex inference from the
implementation. See
[`docs/future-skill-instructions.md`](docs/future-skill-instructions.md) for the
publication workflow intended to become a Codex skill.

See [`presentation.schema.json`](presentation.schema.json) and
[`examples/structural-demo-cpp.presentation.json`](examples/structural-demo-cpp.presentation.json).

## Preserved standalone capabilities

- real source loaded lazily from the registered workspace;
- CodeMirror C++ syntax rendering and line numbers;
- Tree-sitter display-range resolution without requiring a successful build;
- collapsed non-focus function bodies and Codex-marked scaffolding;
- lazy local-reference navigation and external-origin tooltips;
- directed call/read/write navigation with exact occurrence sites;
- per-browser-tab back history; and
- independent scrolling and resizable navigation/code panes.

## Development

```bash
npm install
npm run typecheck
npm run build
npm start -- /path/to/workspace
```

The first invocation starts or discovers the shared local server, registers
the workspace, and prints its stable URL. The browser updates when Codex
replaces `presentation.json`.

See [`docs/translation-plan.md`](docs/translation-plan.md) for the current
increment and later work.
