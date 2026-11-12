# Standalone Codebase Viewer Translation Plan

## Reference behavior to preserve

The source project already provides the correct standalone delivery model:

- one reusable loopback HTTP server for all workspaces;
- stable per-workspace URLs and isolated sessions;
- watched Codex-authored descriptors with SSE refresh;
- source read directly from the registered workspace;
- CodeMirror C++ rendering with line numbers and semantic color;
- Tree-sitter display-range discovery that tolerates incomplete code;
- lazy reference and relationship navigation;
- collapsed non-focus function bodies and scaffolding; and
- independent browser-tab navigation history.

## Product-model translation

| Slice viewer | Codebase viewer |
| --- | --- |
| Active slice | Active Codex-curated codebase presentation |
| Slice element | Block: concrete class or struct |
| Review segment | Block role and scenario participation |
| Segment intent/change | Scenario behavior and participant role |
| Slice pane | Blocks / Scenarios switchable pane |
| Flow inside slice | Code relationships available from either view |
| `.codex/code-viewer/chunk.json` | `.codex/code-viewer/presentation.json` |

References, source focus ranges, scaffolding, relationship occurrence sites,
and out-of-presentation exploration remain code-navigation facilities rather
than slice concepts.

Functions are navigation targets rather than Blocks. They may be opened from
code references, scenario evidence, or flow relationships, but never appear in
the Blocks list or scenario participant membership.

The Blocks view is a containment tree with exactly one root. Parent links mean
"contains" rather than inheritance or call flow; those relationships remain
separate metadata.

## Slice 1 — Load one block/scenario presentation

**Status:** under review

**Central promise:** When Codex publishes a valid C++ codebase presentation,
the standalone viewer shows its Blocks and Scenarios and opens the real source
for a selected block.

### Scenarios

#### 1.1 Browse from a block to code

Given a presentation containing a concrete C++ block with a source location,
when the developer selects the block, then its surrounding source is rendered
read-only with its declared focus visible.

#### 1.2 Browse between blocks and scenarios

Given a many-to-many participation map, when the developer follows a block's
scenario or a scenario's participant, then the opposite view selects the
corresponding item without losing code-navigation history.

### Non-goals

- Automatic codebase discovery; Codex authors the descriptor.
- Human correction overlays.
- Translating slice review markers, `NEW`/`MODIFIED`, or ordered review state.
- Languages other than C++.

### Proof

- Server and client TypeScript typechecks pass.
- The production client and server build succeeds.
- The structural C++ presentation loads with 42 Blocks and 4 Scenarios.
- `/api/blocks/ClassQ` returns the actual `durable.h` source containing
  `class ClassQ`.

## Later slices

2. Preserve lazy references and call/read/write relationships in both views.
3. Add the structural C++ demo as the primary end-to-end presentation.
4. Package the Codex skill that publishes and opens a presentation.
