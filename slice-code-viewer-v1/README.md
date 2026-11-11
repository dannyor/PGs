# Codex code-server extension

This project will connect the Codex desktop app's active task with code-server/VS Code while keeping the human developer in control of review and decisions.

## Intended architecture

```text
Codex desktop task
    │
    │ MCP or shell-invoked CLI
    ▼
local bridge
    │
    │ local JSON-RPC over a Unix socket
    ▼
code-server extension
```

The extension owns editor-facing capabilities. The bridge owns process lifecycle, transport, and the eventual Codex-facing adapter. Codex remains the conversation and task owner; this project must not silently create a separate Codex session.

## Review contract

The AI's declared intent is the focal meeting point of the review. For each slice, scenario, and review item, the integration should make clear what behavioral outcome, rule, responsibility, or invariant the AI believes the work is intended to realize.

Intent is a claim the human can understand, challenge, refine, or accept. The source location, scenario relationship, implementation, and tests support that conversation; they do not replace it. The native review view therefore uses declared intent as the primary clickable row label; the code artifact name, main/test role, kind, scenarios, and source remain supporting metadata.

Every scenario must link to both **TEST CODE** and **MAIN CODE**. The descriptor records this as `codeRole`, validation rejects one-sided scenarios, and the native tree groups both branches directly beneath each scenario. Test and main items use distinct icons and labels; only the current scenario expands automatically.

Native tree views do not support custom row padding or CSS separators. To preserve visual breathing room, only the current scenario and active code-role branch expand automatically; Review Path is collapsed by default, empty Questions are hidden, and the slice promise lives under a compact `Slice intent` section.

The primary review surface is a graphical **Review Canvas** webview: spaced scenario cards, responsive TEST CODE / MAIN CODE sections, intent cards, source navigation, progress, pending questions, and current-item response controls. The native tree remains as a collapsed compact outline. Both surfaces share the same `ReviewSession` and update together.

The native view title follows the active descriptor, so a slice titled `Reservation safety` appears as `SLICE REVIEW: RESERVATION SAFETY`; `Active Slice` is only the empty-state fallback.

Human review distinguishes two decisions:

1. whether the declared intent is right; and
2. whether the implementation and evidence realize it.

## Initial contract candidates

- Read workspace and active-editor state.
- Read the current selection and open-file set.
- Read diagnostics and relevant task or terminal state.
- Open or reveal a file and precise location.
- Apply an explicit workspace edit for human review.
- Execute a narrow allow-list of VS Code commands.
- Return recent extension events on request.

MCP is request-oriented, so unsolicited messages into an existing Codex transcript are not assumed. Event capture should initially be pull-based unless a supported task-specific push contract is established.

## Structure

```text
codex-code-server-extension/
├── README.md
├── extension/   VS Code/code-server extension
├── bridge/      local CLI, JSON-RPC transport, and later MCP adapter
├── docs/        project design and contract documents
└── test/        protocol, extension, and end-to-end tests
```

## First milestone

Deliver a persistent, guided review of one prepared dSlice inside code-server. The developer should be able to move from the slice promise and scenarios to specification evidence and implementation code, record understanding or a question, and resume without losing review position.

The first technical slice establishes the safe round trip in an isolated code-server profile:

1. The extension reports the active workspace, editor, and selection to the bridge.
2. A local CLI requests that state and prints deterministic JSON.
3. The CLI requests a harmless editor action such as revealing a file and line.
4. Tests prove request correlation, unavailable-extension behavior, and explicit failure responses.

Only after this contract is understood should it be wrapped as an MCP server or packaged as a Codex plugin.

See [`docs/milestone-1-plan.md`](docs/milestone-1-plan.md) for the milestone contract, planned behavioral slices, completion criteria, non-goals, and decisions required before implementation.

## Development

Use Node 24 and install the declared development dependencies:

```bash
npm install
npm test
```

`npm test` builds the bridge, CLI, shared protocol, review-state model, and extension bundle before running the specification and coverage tests.

Start the independently supervised local bridge:

```bash
npm run build
node dist/bridge/server.js
```

The bridge prints its Unix-socket path. The containing runtime directory and socket are restricted to the current user. Set `CODEX_CODE_SERVER_SOCKET` in both processes to override the default when code-server and the CLI need an explicit shared location.

After loading this directory as an extension development project or packaging the extension, open the target workspace in code-server. The extension registers that workspace with the bridge and contributes the **Slice Review** Activity Bar view.

The CLI addresses a workspace by the absolute path returned as `workspaceId` by `snapshot`:

```bash
codex-code-server <workspace-id> snapshot
codex-code-server <workspace-id> reveal <workspace-relative-path> <line> <column>
codex-code-server <workspace-id> review-load <descriptor.json>
codex-code-server <workspace-id> review-events <after-sequence>
```

Review descriptors use [`protocol/descriptor.schema.json`](protocol/descriptor.schema.json). Each item carries a declared intent as its primary review claim, plus scenario linkage and a one-based workspace-relative source location.

## Current implementation status

The shared contract, local bridge and CLI, intent-centered native review view, structured human responses, event retrieval, and workspace-state restoration are implemented. The build and 34-test suite pass, and the full reservation-safety demonstration has run through code-server v4.138.0, including source navigation, understanding, questioning, view reopen, server restart, and restored progress with a fresh connection identity. Review status uses native theme icons, and every informational leaf navigates to related source evidence instead of appearing to be a dead control.

The demonstration lives in [`examples/reservation-demo`](examples/reservation-demo). Generate its workspace-bound review descriptor with:

```bash
npm run demo:descriptor -- <workspace-id> <output.json>
```

MS1 is under final human review. Slice 4 and milestone acceptance remain explicit human decisions rather than being inferred from passing automation.

## Baseline evidence

code-server v4.138.0 was checked out and built successfully on Darwin ARM64 using Node 24.18.1. The existing installed code-server v4.112.0 was left untouched. Clean builds are costly because current VS Code bundles large agent extensions, which is another reason to avoid a core code-server fork.
