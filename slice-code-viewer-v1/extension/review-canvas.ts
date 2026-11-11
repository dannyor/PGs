import { randomBytes } from "node:crypto";

import * as vscode from "vscode";

import type { ReviewItem, ReviewProgress } from "../protocol/types.js";
import { buildReviewOutline } from "./review-outline.js";

interface ReviewCanvasActions {
  open(item: ReviewItem): Promise<void>;
  markUnderstood(itemId: string): Promise<void>;
  skip(itemId: string): Promise<void>;
  ask(itemId: string, text: string): Promise<void>;
}

type CanvasMessage =
  | { action: "open" | "understood" | "skip"; itemId: string }
  | { action: "ask"; itemId: string; text: string };

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function itemCard(item: ReviewItem & { status: string; current: boolean }): string {
  const status = item.current ? "current" : item.status;
  const controls = item.current
    ? `<div class="controls">
        <button data-action="understood" data-item="${escapeHtml(item.id)}">Understood</button>
        <button class="secondary" data-action="skip" data-item="${escapeHtml(item.id)}">Skip</button>
        <form data-question="${escapeHtml(item.id)}">
          <input aria-label="Question or challenge" placeholder="Question or challenge…" required>
          <button class="secondary" type="submit">Send</button>
        </form>
      </div>`
    : "";
  return `<article class="review-item ${escapeHtml(status)}">
    <div class="item-heading">
      <span class="status-dot" aria-hidden="true"></span>
      <span class="status-label">${escapeHtml(status)}</span>
    </div>
    <p class="intent">${escapeHtml(item.intent)}</p>
    <p class="meta">${escapeHtml(item.title)} · ${escapeHtml(item.kind)}</p>
    <button class="source" data-action="open" data-item="${escapeHtml(item.id)}">${escapeHtml(item.location.path)}:${item.location.line}</button>
    ${controls}
  </article>`;
}

export function renderReviewCanvas(progress: ReviewProgress | undefined, cspSource: string, nonce: string): string {
  const content = progress === undefined
    ? `<main class="empty"><h1>No active slice</h1><p>Load a review descriptor from Codex to begin.</p></main>`
    : (() => {
        const outline = buildReviewOutline(progress);
        const scenarios = outline.scenarioGroups.map(({ scenario, testItems, mainItems }) => {
          const containsCurrent = [...testItems, ...mainItems].some((item) => item.current);
          return `<details class="scenario" ${containsCurrent ? "open" : ""}>
            <summary>
              <span><strong>${escapeHtml(scenario.id)}</strong> ${escapeHtml(scenario.title)}</span>
              <span class="counts">${testItems.length} test · ${mainItems.length} main</span>
            </summary>
            <p class="behavior">${escapeHtml(scenario.behavior)}</p>
            <div class="role-grid">
              <section class="role test-role">
                <h2>Test code</h2>
                ${testItems.map(itemCard).join("")}
              </section>
              <section class="role main-role">
                <h2>Main code</h2>
                ${mainItems.map(itemCard).join("")}
              </section>
            </div>
          </details>`;
        }).join("");
        const questions = outline.questions.length === 0
          ? ""
          : `<section class="questions"><h2>Pending questions</h2>${outline.questions.map((question) =>
              `<p><strong>${escapeHtml(question.itemId)}</strong> — ${escapeHtml(question.text)}</p>`).join("")}</section>`;
        return `<main>
          <header>
            <p class="eyebrow">Active slice</p>
            <h1>${escapeHtml(outline.title)}</h1>
            <p class="promise">${escapeHtml(outline.promise)}</p>
            <p class="progress">${outline.progress.understood} understood · ${outline.progress.skipped} skipped · ${outline.progress.total} total</p>
          </header>
          <section class="scenarios">${scenarios}</section>
          ${questions}
        </main>`;
      })();

  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
    <style nonce="${nonce}">
      * { box-sizing: border-box; }
      body { margin: 0; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font-family: var(--vscode-font-family); }
      main { padding: 14px; }
      .empty { color: var(--vscode-descriptionForeground); }
      header { padding: 2px 2px 14px; border-bottom: 1px solid var(--vscode-panel-border); }
      .eyebrow { margin: 0 0 4px; color: var(--vscode-descriptionForeground); font-size: 11px; text-transform: uppercase; letter-spacing: .12em; }
      h1 { margin: 0; font-size: 20px; line-height: 1.2; }
      .promise { margin: 8px 0; line-height: 1.45; }
      .progress { margin: 0; color: var(--vscode-descriptionForeground); font-size: 12px; }
      .scenarios { display: grid; gap: 12px; padding-top: 14px; }
      .scenario { border: 1px solid var(--vscode-panel-border); border-radius: 7px; background: var(--vscode-editor-background); overflow: hidden; }
      summary { display: flex; justify-content: space-between; gap: 12px; padding: 12px; cursor: pointer; background: var(--vscode-sideBarSectionHeader-background); }
      .counts { flex: none; color: var(--vscode-descriptionForeground); font-size: 11px; }
      .behavior { margin: 0; padding: 12px; color: var(--vscode-descriptionForeground); line-height: 1.4; border-top: 1px solid var(--vscode-panel-border); }
      .role-grid { display: grid; gap: 12px; padding: 0 12px 12px; }
      .role { min-width: 0; }
      .role h2, .questions h2 { margin: 10px 0 7px; font-size: 11px; text-transform: uppercase; letter-spacing: .1em; }
      .test-role h2 { color: var(--vscode-testing-iconPassed); }
      .main-role h2 { color: var(--vscode-symbolIcon-classForeground); }
      .review-item { margin-top: 8px; padding: 11px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: var(--vscode-input-background); }
      .review-item.current { border-color: var(--vscode-focusBorder); box-shadow: 0 0 0 1px var(--vscode-focusBorder); }
      .review-item.understood { opacity: .72; }
      .review-item.skipped { opacity: .58; }
      .item-heading { display: flex; align-items: center; gap: 6px; color: var(--vscode-descriptionForeground); font-size: 10px; text-transform: uppercase; }
      .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--vscode-descriptionForeground); }
      .current .status-dot { background: var(--vscode-focusBorder); }
      .understood .status-dot { background: var(--vscode-testing-iconPassed); }
      .intent { margin: 7px 0; line-height: 1.4; font-weight: 600; }
      .meta { margin: 0 0 7px; color: var(--vscode-descriptionForeground); font-size: 11px; }
      button, input { font: inherit; }
      button { border: 1px solid transparent; border-radius: 3px; padding: 5px 9px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); cursor: pointer; }
      button:hover { background: var(--vscode-button-hoverBackground); }
      button.secondary, button.source { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
      button.source { width: 100%; overflow: hidden; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
      .controls { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
      form { display: flex; flex: 1 1 100%; gap: 6px; }
      input { min-width: 0; flex: 1; padding: 6px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); }
      .questions { margin-top: 14px; padding-top: 8px; border-top: 1px solid var(--vscode-panel-border); }
      .questions p { padding: 8px; background: var(--vscode-input-background); border-radius: 5px; }
      @media (min-width: 620px) { .role-grid { grid-template-columns: 1fr 1fr; } }
    </style>
  </head>
  <body>
    ${content}
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      document.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        vscode.postMessage({ action: button.dataset.action, itemId: button.dataset.item });
      });
      document.addEventListener('submit', (event) => {
        const form = event.target.closest('form[data-question]');
        if (!form) return;
        event.preventDefault();
        const input = form.querySelector('input');
        const text = input.value.trim();
        if (!text) return;
        vscode.postMessage({ action: 'ask', itemId: form.dataset.question, text });
        input.value = '';
      });
    </script>
  </body>
  </html>`;
}

export class ReviewCanvasProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;

  constructor(
    private readonly getProgress: () => ReviewProgress | undefined,
    private readonly actions: ReviewCanvasActions
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [] };
    view.webview.onDidReceiveMessage((message: CanvasMessage) => void this.handleMessage(message));
    this.refresh();
  }

  refresh(): void {
    if (this.view === undefined) return;
    this.view.webview.html = renderReviewCanvas(
      this.getProgress(),
      this.view.webview.cspSource,
      randomBytes(16).toString("hex")
    );
  }

  private async handleMessage(message: CanvasMessage): Promise<void> {
    const progress = this.getProgress();
    const item = progress?.descriptor.items.find((candidate) => candidate.id === message.itemId);
    if (item === undefined) return;
    if (message.action === "open") await this.actions.open(item);
    if (message.action === "understood") await this.actions.markUnderstood(item.id);
    if (message.action === "skip") await this.actions.skip(item.id);
    if (message.action === "ask" && message.text.trim() !== "") await this.actions.ask(item.id, message.text);
  }
}
