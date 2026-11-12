# Future Codebase Viewer Skill Instructions

This file is the draft operating contract for a future Codex skill that
publishes a codebase into the standalone Entities and Scenarios viewer. It is not
yet an installed skill.

## Purpose

Given a workspace directory, curate an evidence-backed presentation that helps
a developer explore real code through three linked views:

- **Entities:** the tangible class/struct Block containment hierarchy;
- **Scenarios:** observable behaviors grounded primarily in tests.
- **Entity Map:** the same Block containment hierarchy as a graph projection.

The skill writes `.codex/code-viewer/presentation.json`, registers the
workspace with the standalone viewer, and opens or returns its stable URL.
Codex performs the curation. The viewer does not discover or explain the
codebase autonomously.

Entity Map needs no additional discovery contract. It is derived only from the
Codex-authored Block IDs and `parentId` links. Functions and Scenarios must not
become primary map nodes.

The Entities view and associated Scenarios must remain visible together.
Selecting an Entity filters the adjacent Scenario panel to the behaviors in
which that Block participates; opening one moves to the full Scenarios view.

## Required source order

Before describing or arranging code, inspect sources in this order:

1. applicable `AGENTS.md` and project-local agent context;
2. project README, architecture, user-guide, and component documentation;
3. specification tests, followed by coverage and integration tests;
4. declarations, ownership members, constructors, factories, and bindings;
5. nearby source comments; and
6. implementation code needed to close remaining gaps.

Respect repository instructions that restrict which reference implementations
or proprietary sources may be inspected.

## Block selection

- A Block is a tangible class or struct that is instantiated or represents a
  concrete implementation participant worth navigating.
- Functions, methods, enums, aliases, configuration records, and passive data
  carriers are not Blocks by default.
- Publish every declared function of each shown Block with a stable ID, owning
  Block, source path, and symbol. Add a concise role when documentation,
  comments, or the implementation supports one. The viewer shows the complete
  set in the selected Block's inline drawer without adding functions to the
  containment tree.
- Exclude constructors from the Function catalog. Construction responsibility
  belongs to the Block's Structure type and containment description; a
  constructor entry adds noise without improving behavioral navigation.
- Scenarios name only the specific published functions that realize their behavior,
  with a short role for each function.
- Functions remain navigable through the inline drawer, Scenario function
  links, exact reference hints, and call/read/write relationships.
- Prefer a small explanatory runtime/ownership spine over a symbol inventory.
- Exclude a component when its containment would be speculative. A useful
  incomplete presentation is better than a false complete hierarchy.

## Containment hierarchy

- Publish exactly one root Block.
- Every other Block must have exactly one containing parent.
- `parentId` means ownership/runtime containment, not inheritance, namespace,
  call flow, file layout, or conceptual association.
- Prove containment from members, construction, factories, module hierarchy,
  or explicit project documentation.
- Reject cycles, missing parents, and Blocks unreachable from the root.
- When the codebase has several independent roots, curate one coherent runtime
  presentation or add a real owning root already present in the code. Never
  invent a synthetic Block merely to satisfy the schema.

## Block descriptions

Write one short `role` description for every Block. This text appears in the
entity popup.

Use evidence in this priority:

1. **README/component documentation:** paraphrase the established mission or
   responsibility.
2. **Nearby comments:** use declaration and ownership comments to refine the
   description.
3. **Codex deduction:** infer only what constructors, members, interfaces, and
   implementation clearly support.

Description rules:

- Use one concise sentence, normally 8–24 words.
- State what the entity owns or accomplishes, not merely its filename or type.
- Prefer project terminology exactly as used by the code and documentation.
- Do not claim planned behavior as implemented behavior.
- Do not turn inheritance or calls into ownership claims.
- Avoid generic phrases such as “handles logic” or “manages things.”
- When evidence is incomplete, narrow the wording rather than guessing.

## Scenario discovery

- Start with reader-first specification tests when present.
- Use coverage tests for boundaries, pressure, rejection, ordering, reset, and
  regressions around an established behavior.
- Each Scenario states actor/caller, starting state, action, and observable
  result.
- Scenario participants are Blocks only. Attach a concise behavioral role to
  each participant.
- Scenario functions are separate from participants. They identify the methods
  that implement the behavior without promoting those methods to Blocks.
- Publish one ordered nested `sequence` per Scenario. Each step references a
  published Function and may contain child calls. The viewer derives the
  linear `Entity.function()` path, nested numbered list, and SVG sequence
  diagram from this one source so the projections cannot drift.
Basic should aggregate the trace by Entity and render one vertical row per
Entity with the first Function plus a `+N funcs` count. Coverage counts in the
hierarchy must be explicit text such as `2 cov`, never unlabeled badges.
- In the selected Scenario panel, publish test evidence in one collapsed
  `Tests` drawer. Separate reader-first `Specification tests` from `Coverage
  cases`; each evidence item must navigate to its declared test file and line
  without clearing the selected Scenario.
- Keep scenarios behavior-focused; do not create one scenario per test case.
- Distinguish specification, coverage, main-code, and documentation evidence.

## Scenario hierarchy methodology

Organize behavior using four distinct levels:

1. **Behavior Area:** navigation grouping such as Requester L2 or Timing
   Adapter. It is not executable behavior.
2. **Capability:** one cohesive central promise and ownership boundary, such as
   completing AXI reads.
3. **Primary Scenario:** one actor, starting state, action, and distinct
   observable result.
4. **Coverage Case:** capacity, ordering, invalid input, reset, pressure,
   permutation, or regression evidence supporting a Primary Scenario.

Execution steps are orthogonal trace data beneath a Primary Scenario, not
another Scenario level.

Use these split rules:

- different observable result: different Primary Scenario;
- different ownership boundary or state-machine phase: usually different
  Primary Scenario or Capability;
- same promise with different values, ordering, capacity, or pressure:
  Coverage Case;
- different implementation path with the same observable contract: one
  Primary Scenario unless the path itself is contractual;
- integration test: evidence for an existing Primary Scenario unless it adds a
  new cross-component promise;
- defensive internal condition without domain-observable behavior: Coverage
  Case, not a Primary Scenario.

Derive the hierarchy in this order:

1. inventory reader-first specification tests;
2. rewrite candidates as actor/state/action/result;
3. cluster by central promise and ownership boundary;
4. promote only distinct observable outcomes to Primary Scenarios;
5. attach remaining tests as Coverage Cases;
6. attach specification, coverage, main-code, and documentation evidence;
7. add one ordered nested Function trace; and
8. reject orphan Coverage Cases with no parent behavioral contract.

Assign stable IDs at every level and never renumber accepted IDs merely to
tidy the presentation.

## Code types

Attach one or more Code types to every shown Block and Function:

- `behavior`: runtime decisions, algorithms, state transitions, or progress;
- `contract`: validation, eligibility, queries, invariants, or boundary rules;
- `structure`: construction, ownership, lifetime, storage, or setup;
- `wiring`: binding, routing, adaptation, or cross-component connection.

Use the smallest accurate set. Code types describe what the entity or function
does; they are not review status, change status, or Scenario identity.

## Code navigation

- Source paths are workspace-relative and must stay inside the workspace.
- Focus ranges should show the entity declaration or the most useful owned
  context without copying source into the descriptor.
- Add exact local reference hints for important functions and types that a
  developer is likely to follow.
- Use origin-only hints for unavailable external symbols.
- Add call/read/write relationships only when the occurrence sites are known;
  mark ambiguous or virtual flow as `possible`.

## Publication checks

Before publishing:

1. validate the descriptor against `presentation.schema.json`;
2. confirm exactly one root and full Block reachability;
3. confirm every Scenario participant references a Block;
4. confirm every source/evidence path exists inside the workspace;
5. load at least one Block and verify real source is returned;
6. resolve at least one important function target; and
7. report deliberate exclusions and inference limits.

The publication workflow must not build or modify the target codebase unless
the user separately asks for implementation or validation work.
