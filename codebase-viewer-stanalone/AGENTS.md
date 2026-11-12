# Project Instructions

- Use the `dnotes` skill throughout work on this project.
- Resolve project notes beneath the configured personal `DNOTES_ROOT` in the
  `codebase-viewer-stanalone` directory.
- Treat the sibling `stanalone-slice-viewer` project as the delivery and
  interaction reference, not as the product model.
- Preserve the standalone viewer's real code surface, lazy C++ navigation,
  shared loopback server, workspace isolation, descriptor watching, and
  per-browser-tab history.
- Replace slice-specific concepts with Codex-curated Blocks and Scenarios.
  Do not reintroduce slice membership, review segments, or change status as
  primary navigation concepts.
- Blocks are tangible classes and structs. Functions are navigable code
  targets, not Blocks and not entries in the Blocks list.
- Blocks form a containment hierarchy with exactly one root. Every non-root
  Block must have one valid parent and be reachable from that root.
- Keep Entities, Scenarios, and Entity Map enabled as peer navigation views.
  Entity Map contains Block nodes only and shares selection/source semantics
  with the Blocks tree.
- Entity selection must keep an adjacent associated-Scenarios panel visible so
  the structural and behavioral projections resonate.
- Publish Scenarios with one ordered nested Function sequence. Derive Basic,
  Nested, and interactive SVG Sequence projections from that same descriptor
  data so the three views cannot drift.
- Follow `docs/future-skill-instructions.md` when curating presentations. Block
  descriptions should use README/context documentation first, nearby comments
  second, and restrained Codex inference last.
