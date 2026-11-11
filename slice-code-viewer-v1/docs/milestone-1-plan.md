# Milestone 1: Guided slice review in code-server

**Status:** under review

This document is the authoritative MS1 plan and scenario record.

## Outcome

A developer can open one prepared dSlice in code-server, understand its promise and scenarios, walk through its specification evidence and implementation pieces in a deliberate order, record understanding or a question at each meaningful junction, and resume the review without losing position.

The active Codex desktop task remains the conversation and orchestration owner. The extension provides the persistent editor-native review experience; the local bridge provides structured request/response communication between them.

## Why this is the first milestone

This is the smallest end-to-end experience that tests the project's product thesis rather than only its transport. It combines the strongest capabilities currently explored separately by dSlice, write-slice-test-specs, Code Slice Viewer, and dSliceRevU in a new code-server-native form.

The milestone should answer two questions:

1. Does a persistent, behavior-first review inside the editor make an AI-produced change easier to understand than chat plus ordinary diff navigation?
2. What structured context and interaction must pass between Codex and code-server to sustain that review?

## Milestone contract

### Promise

For one prepared behavioral slice in the current workspace, the developer can follow a traceable path from intent to evidence to implementation and return a structured response to the active Codex task.

### Boundary

- Codex prepares or selects the slice and communicates through the local bridge.
- The bridge owns protocol adaptation, connection identity, request correlation, and extension availability.
- The extension owns editor state, review presentation, navigation, and persisted review progress.
- The developer owns understanding, questions, and decisions. Marking a step understood never implies that the code is correct or approved.

### State

The extension holds one active review session containing:

- slice identity, title, central promise, and scenarios;
- ordered review items and their links to scenarios;
- source locations for specification evidence and implementation elements;
- current item;
- per-item state: `unviewed`, `understood`, or `skipped`;
- optional developer question or note; and
- schema version and workspace identity.

Review state persists across view closure and extension reload for the same workspace. Loading a different slice replaces the active review only through an explicit request.

### Pressure and failure behavior

- Requests fail explicitly when no compatible extension is connected.
- A stale connection cannot receive a new request.
- Paths outside the active workspace are rejected.
- Missing files, invalid locations, incompatible schemas, and malformed review descriptors return distinct errors.
- Repeated commands carry request IDs and do not silently duplicate state transitions.
- An unanswered developer question remains pending until Codex retrieves or explicitly resolves it.

## Planned slices

### Slice 1 — Establish the safe Codex/editor boundary

**Status:** complete

**Central promise:** The local client can identify the connected extension, inspect harmless workspace/editor context, and reveal a valid workspace location with deterministic success or failure.

#### Scenarios

- **1.1 Connected workspace snapshot:** Given one compatible extension connected for the current workspace, when the client requests a snapshot, it receives the workspace identity, active file, selection, visible editors, connection identity, schema version, and event sequence.
- **1.2 Safe source reveal:** Given a valid workspace-relative source location, when the client requests reveal, code-server opens the file and places the location in view without editing it.
- **1.3 Explicit unavailable or stale failure:** Given no live compatible extension, or a superseded connection, when the client sends a request, it receives a distinct actionable error.
- **1.4 Workspace boundary rejection:** Given a path outside the connected workspace or an invalid location, when reveal is requested, the extension rejects it without navigation or file mutation.

**Proof:** Reader-first protocol tests plus focused coverage for malformed messages, duplicate request IDs, missing files, and invalid ranges.

**Completion evidence:**

- One reader-first executable specification now corresponds to each primary scenario 1.1–1.4.
- The full TypeScript build, extension bundle, and 19-test suite pass.
- The official code-server v4.138.0 Darwin ARM64 release loaded the extension in a disposable profile.
- A real CLI/bridge/extension snapshot returned the v4.138.0 workspace identity, active `README.md`, selection, visible editor, connection identity, schema version, and event sequence.
- A real reveal moved `README.md` from line 14 to line 20 without editing it.
- Outside-workspace, missing-file, and invalid-location requests returned their distinct errors and left the editor at line 20.
- Stopping code-server produced `extension-unavailable`; deterministic stale-connection behavior is covered at the bridge boundary by the 1.3 specification.
- The user completed the four-step understanding review and explicitly accepted Slice 1 on 2026-09-23.

### Slice 2 — Load one coherent review session

**Status:** complete

**Central promise:** Codex can load a prepared dSlice review descriptor and the developer sees one coherent, traceable review session in code-server.

#### Scenarios

- **2.1 Review overview:** Given a valid descriptor for the current workspace, when Codex loads it, the extension shows the slice promise, scenarios, review progress, and first recommended item.
- **2.2 Intent-centered review item:** Given an item linked to a scenario, test, or main-code element, when the developer selects its declared intent, the view reveals the exact source location so the human can judge implementation or evidence against that intent.
- **2.3 Invalid descriptor rejection:** Given an incompatible schema, duplicate identity, missing required relationship, or out-of-workspace source location, when Codex loads the descriptor, the existing review remains intact and the request returns an explicit error.
- **2.4 Explicit replacement:** Given an active review, when Codex explicitly loads a different valid slice, the extension replaces the session and reports the transition.

**Proof:** Descriptor contract tests, extension view tests, and navigation integration tests.

**Completion evidence:**

- One reader-first executable specification corresponds to each primary scenario 2.1–2.4.
- The complete TypeScript build, extension bundle, and 23-test suite pass.
- The official code-server v4.138.0 profile loaded a valid descriptor and displayed the promise, scenario, `0/2` progress, and first item visibly marked `current`.
- Selecting the first review item opened its exact source file; a subsequent snapshot confirmed line 16, column 1.
- Loading an invalid descriptor returned `invalid-descriptor` and left the original review visible and active.
- Explicitly loading a second valid descriptor returned both the new review ID and `replacedReviewId`; the native view changed to the replacement promise, scenario, and item.
- Adding explicit Node and VS Code ambient types removed two editor-only TypeScript diagnostics; code-server reported no remaining workspace problems.
- Human-review feedback refined the contract: intent, not reason-for-inclusion or the code artifact name, is the focal meeting point. Each main/test review item now uses declared intent as its primary clickable label, with artifact name, role, kind, scenarios, and source as supporting metadata.
- Fresh v4.138.0 validation restored the active review with the current intent visible while the associated TypeScript file was open at line 16, column 1. The workspace reported no problems.
- The user completed the resumed four-step understanding review and explicitly accepted the intent-centered Slice 2 on 2026-09-23.

### Slice 3 — Guide and capture the human review

**Status:** complete

**Central promise:** The developer can advance through the slice deliberately and Codex can retrieve structured review progress and questions.

#### Scenarios

- **3.1 Mark intent understood and advance:** Given the current review item, when the developer marks its declared intent understood, its state becomes `understood` and the next ordered item becomes current.
- **3.2 Ask without advancing:** Given an unclear item, when the developer records a question, the item remains current and the question becomes pending for Codex.
- **3.3 Skip explicitly:** Given an item the developer chooses not to inspect, when it is skipped, the state records that distinction and advances without claiming understanding.
- **3.4 Retrieve review events:** Given new human review actions, when Codex requests events after a known sequence, it receives ordered structured events without duplicates.
- **3.5 Separate understanding from approval:** Given all items understood or skipped, when the walkthrough reaches its end, the UI reports review coverage but does not label the intent or code approved.

**Proof:** Review state-machine specification tests plus coverage for repeated actions, empty questions, and event retrieval boundaries.

**Completion evidence:**

- One reader-first executable specification corresponds to each primary scenario 3.1–3.5.
- The complete TypeScript build, extension bundle, and 26-test suite pass.
- The contract now stores `understood`, emits `intent-understood`, and never substitutes ambiguous `viewed` terminology.
- In a fresh official code-server v4.138.0 profile, marking the first declared intent understood advanced to the next intent; progress changed to `1 understood, 0 skipped / 2`.
- Asking “What invariant should this outline preserve?” kept the second item current and displayed the question in the review.
- Explicitly skipping the second item produced `1 understood, 1 skipped / 2` without an approval state.
- CLI retrieval returned ordered sequences for `intent-understood`, `question-asked`, and `item-skipped`; repeated retrieval after sequence 1 returned the same two later events without duplicates.
- Reapplying `understood` or attempting to replace it with `skipped` on a terminal item is a no-op: state, current item, event sequence, and event count remain unchanged.
- The status tooltip explicitly states that understood/skipped counts are review coverage, not approval.
- Removing the redundant activation event cleared the final code-server manifest warning; the workspace reported no problems.
- The user completed the four-step understanding review and explicitly accepted Slice 3 on 2026-09-23 with the documented shared question/challenge event-type limitation.

### Slice 4 — Resume the same review

**Status:** under review

**Central promise:** A developer can return to an interrupted review in the same workspace without reconstructing progress.

#### Scenarios

- **4.1 Resume after view closure:** Given a partially completed review, when its view is closed and reopened, the same slice, current item, progress, and pending questions are restored.
- **4.2 Resume after extension restart:** Given persisted review state, when the extension restarts in the same workspace, it restores compatible state and reports its new connection identity.
- **4.3 Reject incompatible saved state:** Given saved state from an unsupported schema or different workspace, when restoration is attempted, the extension leaves it inactive and reports why rather than guessing or corrupting it.

**Proof:** Persistence tests and one restart-level integration test.

**Completion evidence:**

- One reader-first executable specification corresponds to each primary scenario 4.1–4.3, plus malformed-state coverage.
- The complete TypeScript build, extension bundle, and 28-test suite pass.
- Closing and reopening the Slice Review view in code-server v4.138.0 preserved the same review, `1 understood, 1 skipped / 2` progress, and pending question.
- Restarting code-server against the same disposable profile restored the same review state and event sequence `3`.
- The extension connection identity changed from `36c016c0-bb52-4a17-be31-76f23cfb31c0` before restart to `ac8551ac-72f7-49c7-b2e8-3eafbab0626a` afterward.
- Unsupported schema, foreign-workspace state, obsolete `viewed` status, and incomplete saved state remain inactive with distinct restoration results; rejected state exposes its explanation in the empty native review view.
- The restored v4.138.0 workspace reported no problems.
- Slice 4 awaits the human review gate before it can be marked complete.

## End-to-end demonstration

Milestone 1 is demonstrated with the reservation-safety example in `examples/reservation-demo/`. It has:

- one documented slice promise;
- two or more primary scenarios;
- reader-first specification evidence;
- focused implementation elements; and
- at least one relationship between a scenario, a test, and implementation code.

The selected example declares one central intent and three primary scenarios: successful reservation, idempotent retry, and atomic rejection. Six ordered review items connect reader-first specifications to the observable result contract, inventory mutation owner, and reservation orchestration.

Executed end-to-end evidence on code-server v4.138.0:

- Generated a workspace-bound descriptor with `npm run demo:descriptor` and loaded all six items through the CLI/bridge/extension path.
- Opened the first specification at line 14 and marked its declared intent understood.
- Advanced to the idempotent-retry intent and recorded the pending question “How is request identity protected from content drift?” without advancing.
- Closed and reopened the view; progress and the question remained.
- Restarted code-server against the same disposable profile; the review resumed at the same intent with `1 understood, 0 skipped / 6` and event sequence `2`.
- The extension connection identity changed from `1def4e67-0ced-4d78-9230-2b2989186849` to `b81c757e-6776-465c-b4c3-edb07a4329b9`.
- The full build and 33-test suite passed, including the example's three specification tests plus retry-conflict and duplicate-SKU atomicity coverage.
- A human UI evaluation found literal codicon markup and misleading dead-looking leaf rows. The tree now uses native `ThemeIcon` values, and promise, scenario, intent, source, and question leaves navigate to the relevant review item's source. Live verification opened the Source row at line 28 and scenario `DEMO.3` at line 40.
- Human review then clarified that every scenario must present both main code and test code. Added required `codeRole` metadata, validation that rejects any scenario missing either role, and scenario-local TEST CODE / MAIN CODE branches. Only the scenario containing the current item expands automatically.
- Live verification showed `DEMO.1` with one TEST CODE item and three MAIN CODE items; selecting Inventory mutation owner opened `inventory-ledger.ts` at line 18.
- Human review found a separate `Intent` child unnatural. Review items now use the declared intent itself as the primary clickable row; artifact name, TEST/MAIN role, kind, scenario IDs, and source are supporting description/tooltip metadata. Live verification showed intent-first rows and navigation to the observable result contract at `types.ts` line 17.
- The view title now follows the active descriptor title instead of remaining the static `Active Slice`; live verification showed `SLICE REVIEW: RESERVATION SAFETY`.
- To reduce crowding within native TreeView constraints, only the current scenario and active TEST/MAIN branch expand automatically; Review Path defaults collapsed, empty Questions are omitted, and the duplicate root title becomes `Slice intent`. Live verification confirmed the reduced-density layout.
- Added a synchronized graphical Review Canvas webview because native TreeView cannot control row spacing or separators. It presents spaced scenario cards, TEST/MAIN sections, intent cards, source navigation, progress, questions, and Understood/Skip/Question controls. The native outline remains available but collapsed by default. Live verification opened main source at `types.ts` line 17 from the canvas.
- The corrected full build and 36-test suite pass.

The demo remains open in the code-server UI as the starting point for human evaluation. Final Slice 4 and MS1 acceptance remain explicit human decisions.

## Completion criteria

Milestone 1 is complete when:

- all four slice promises and their scenarios are proven by their stated tests;
- the end-to-end demonstration runs against the selected isolated code-server baseline;
- protocol and persisted-state schemas are versioned;
- review state never conflates `understood`, `skipped`, and intent or code approval;
- failure cases leave the existing editor and review state safe;
- the user completes a guided review of the demonstration slice and accepts the milestone experience as understandable; and
- deferred behavior is recorded rather than hidden in partial implementation.

## Non-goals

Milestone 1 does not include:

- editing source code or applying workspace edits;
- executing arbitrary VS Code commands, tasks, or terminals;
- automatically deriving a slice from an arbitrary diff inside the extension;
- authoring or aligning tests through the extension;
- reproducing the full Code Slice Viewer reference graph;
- unsolicited injection into the Codex transcript;
- multiple simultaneous review sessions or collaborative users;
- remote-machine transport or cross-user authentication;
- a production MCP adapter or distributable Codex plugin; or
- a general-purpose replacement for VS Code source control and diff views.

## Decisions required before Slice 1 implementation

The implementation starts with these accepted development choices:

1. Use the isolated code-server v4.138.0 build as the development baseline while avoiding unnecessary dependence on recent VS Code APIs.
2. Run the bridge as an independently supervised local process. The extension and CLI connect as clients and may reconnect without owning each other's lifecycle.
3. Use versioned JSON messages and JSON Schema documents. A review descriptor contains slice metadata, scenarios, ordered semantic review items, their relationships, concise intent, and workspace-relative locations; it does not copy source.
4. Persist one active review with VS Code workspace state. Bind persisted state to the workspace identity and descriptor identity.
5. Use native VS Code views and commands first. Introduce a webview only if evaluation shows that the native surface cannot support comprehension.

The real demonstration slice remains to be selected before milestone acceptance.

## Deferred direction

Later milestones may add Codex-driven slice construction, richer semantic relationships, specification authoring, safe edits, approval workflows, MCP/plugin packaging, and empirical measures of review comprehension. They should build on evidence from this milestone rather than expanding the editor protocol speculatively.
