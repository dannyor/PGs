import { randomUUID } from "node:crypto";
import { relative, resolve, sep } from "node:path";

import * as vscode from "vscode";

import { type ReviewItem, type RpcErrorCode, type RpcRequest, type RpcResponse, type SourceLocation } from "../protocol/types.js";
import { ExtensionBridgeClient } from "./bridge-client.js";
import { BoundaryError, handleBoundaryRequest, type EditorBoundary } from "./editor-boundary.js";
import { ReviewSession } from "./review-session.js";
import { handleReviewRequest, type ReviewLoader } from "./review-boundary.js";
import { ReviewCanvasProvider } from "./review-canvas.js";
import { reviewViewTitle } from "./review-outline.js";
import { ReviewTreeItem, ReviewTreeProvider } from "./review-tree.js";

function workspaceRoot(): vscode.Uri {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (root === undefined || root.scheme !== "file") throw new Error("Slice Review requires one local workspace folder");
  return root;
}

function workspaceId(): string {
  return workspaceRoot().fsPath;
}

function rpcError(request: RpcRequest, code: RpcErrorCode, message: string): RpcResponse {
  return { kind: "response", id: request.id, error: { code, message } };
}

function workspaceUri(location: SourceLocation): vscode.Uri {
  const root = workspaceRoot().fsPath;
  const target = resolve(root, location.path);
  const fromRoot = relative(root, target);
  if (fromRoot === "" || fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || resolve(target) === resolve(root)) {
    throw new BoundaryError("outside-workspace", "location must name a file inside the workspace");
  }
  return vscode.Uri.file(target);
}

async function reveal(location: SourceLocation): Promise<void> {
  const uri = workspaceUri(location);
  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    throw new BoundaryError("missing-file", `file does not exist: ${location.path}`);
  }
  const document = await vscode.workspace.openTextDocument(uri);
  if (location.line < 1 || location.line > document.lineCount || location.column < 1) {
    throw new BoundaryError("invalid-location", "location is outside the document");
  }
  const line = document.lineAt(location.line - 1);
  if (location.column > line.text.length + 1) throw new BoundaryError("invalid-location", "location is outside the document");
  const position = new vscode.Position(location.line - 1, location.column - 1);
  const editor = await vscode.window.showTextDocument(document, { preview: false });
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

export function activate(context: vscode.ExtensionContext): void {
  const rootId = workspaceId();
  const connectionId = randomUUID();
  const output = vscode.window.createOutputChannel("Codex Slice Review");
  let canvasProvider: ReviewCanvasProvider | undefined;
  const treeProvider = new ReviewTreeProvider(() => session.current, () => session.restorationNotice);
  const session = new ReviewSession(rootId, connectionId, context.workspaceState, () => {
    treeProvider.refresh();
    canvasProvider?.refresh();
    refreshStatus();
  });
  const tree = vscode.window.createTreeView("codexSliceReview.review", { treeDataProvider: treeProvider, showCollapseAll: true });
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  status.command = "workbench.view.extension.codexSliceReview";

  function refreshStatus(): void {
    const progress = session.current;
    tree.title = reviewViewTitle(progress);
    if (progress === undefined) {
      status.hide();
      return;
    }
    const understood = Object.values(progress.itemStatuses).filter((value) => value === "understood").length;
    const skipped = Object.values(progress.itemStatuses).filter((value) => value === "skipped").length;
    status.text = `$(list-tree) ${progress.descriptor.title}: ${understood}+${skipped}/${progress.descriptor.items.length}`;
    status.tooltip = `${understood} intents understood, ${skipped} items skipped. This is review coverage, not approval.`;
    status.show();
  }

  async function openItem(value?: ReviewItem | ReviewTreeItem): Promise<void> {
    if (value === undefined) return;
    const reviewItem = value instanceof ReviewTreeItem ? value.reviewItem : value;
    if (reviewItem !== undefined) await reveal(reviewItem.location);
  }

  async function itemId(node?: ReviewTreeItem): Promise<string | undefined> {
    return node?.reviewItem?.id ?? session.current?.currentItemId;
  }

  const commands = [
    vscode.commands.registerCommand("codexSliceReview.open", openItem),
    vscode.commands.registerCommand("codexSliceReview.markUnderstood", async (node?: ReviewTreeItem) => {
      const id = await itemId(node);
      if (id !== undefined) await session.markUnderstood(id);
      refreshStatus();
    }),
    vscode.commands.registerCommand("codexSliceReview.skip", async (node?: ReviewTreeItem) => {
      const id = await itemId(node);
      if (id !== undefined) await session.skip(id);
      refreshStatus();
    }),
    vscode.commands.registerCommand("codexSliceReview.ask", async (node?: ReviewTreeItem) => {
      const id = await itemId(node);
      if (id === undefined) return;
      const question = await vscode.window.showInputBox({ prompt: "What should Codex explain or reconsider?", ignoreFocusOut: true });
      if (question !== undefined && question.trim() !== "") await session.ask(id, question);
      refreshStatus();
    })
  ];

  const editorBoundary: EditorBoundary = {
    snapshot: async () => {
      const active = vscode.window.activeTextEditor;
      return {
        activeFile: active === undefined ? undefined : relative(workspaceRoot().fsPath, active.document.uri.fsPath),
        selection: active === undefined ? undefined : {
          startLine: active.selection.start.line + 1,
          startColumn: active.selection.start.character + 1,
          endLine: active.selection.end.line + 1,
          endColumn: active.selection.end.character + 1
        },
        visibleEditors: vscode.window.visibleTextEditors.map((editor) => relative(workspaceRoot().fsPath, editor.document.uri.fsPath))
      };
    },
    reveal
  };
  const reviewLoader: ReviewLoader = {
    currentReviewId: () => session.current?.descriptor.id,
    load: async (descriptor) => {
      await session.load(descriptor);
      refreshStatus();
    }
  };

  canvasProvider = new ReviewCanvasProvider(() => session.current, {
    open: async (item) => openItem(item),
    markUnderstood: async (itemId) => session.markUnderstood(itemId),
    skip: async (itemId) => session.skip(itemId),
    ask: async (itemId, text) => session.ask(itemId, text)
  });
  const canvasRegistration = vscode.window.registerWebviewViewProvider(
    "codexSliceReview.canvas",
    canvasProvider,
    { webviewOptions: { retainContextWhenHidden: true } }
  );

  async function handleRequest(request: RpcRequest): Promise<RpcResponse> {
    try {
      const boundaryResponse = await handleBoundaryRequest(request, {
        workspaceId: rootId,
        connectionId,
        eventSequence: () => session.current?.nextSequence === undefined ? 0 : session.current.nextSequence - 1,
        editor: editorBoundary
      });
      if (boundaryResponse !== undefined) return boundaryResponse;
      const reviewResponse = await handleReviewRequest(request, { workspaceId: rootId, loader: reviewLoader });
      if (reviewResponse !== undefined) return reviewResponse;
      if (request.method === "review.events") {
        const params = request.params as { afterSequence?: unknown } | undefined;
        const afterSequence = params?.afterSequence;
        if (!Number.isInteger(afterSequence) || (afterSequence as number) < 0) throw new Error("afterSequence must be a non-negative integer");
        return { kind: "response", id: request.id, result: session.eventsAfter(afterSequence as number) };
      }
      return rpcError(request, "invalid-request", `unknown method ${request.method}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return rpcError(request, "invalid-request", message);
    }
  }

  const bridge = new ExtensionBridgeClient(rootId, connectionId, handleRequest, (message) => output.appendLine(message));
  bridge.start();
  refreshStatus();
  context.subscriptions.push(output, tree, status, bridge, canvasRegistration, ...commands);
}

export function deactivate(): void {}
