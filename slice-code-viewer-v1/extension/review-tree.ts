import * as vscode from "vscode";

import type { ReviewCodeRole, ReviewItem, ReviewProgress } from "../protocol/types.js";
import { buildReviewOutline, reviewItemIcon } from "./review-outline.js";

interface ReviewTreeItemOptions {
  reviewItem?: ReviewItem;
  iconId?: string;
  showReviewActions?: boolean;
  scenarioId?: string;
  codeRole?: ReviewCodeRole;
}

export class ReviewTreeItem extends vscode.TreeItem {
  readonly reviewItem: ReviewItem | undefined;
  readonly scenarioId: string | undefined;
  readonly codeRole: ReviewCodeRole | undefined;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    options: ReviewTreeItemOptions = {}
  ) {
    super(label, collapsibleState);
    this.reviewItem = options.reviewItem;
    this.scenarioId = options.scenarioId;
    this.codeRole = options.codeRole;
    if (options.iconId !== undefined) this.iconPath = new vscode.ThemeIcon(options.iconId);
    if (options.reviewItem !== undefined) {
      if (options.showReviewActions !== false) this.contextValue = "reviewItem";
      this.command = { command: "codexSliceReview.open", title: "Open review item", arguments: [options.reviewItem] };
      this.tooltip = new vscode.MarkdownString(`**Declared intent**\n\n${options.reviewItem.intent}`);
    }
  }
}

export class ReviewTreeProvider implements vscode.TreeDataProvider<ReviewTreeItem> {
  private readonly changes = new vscode.EventEmitter<ReviewTreeItem | undefined>();
  readonly onDidChangeTreeData = this.changes.event;

  constructor(
    private readonly getProgress: () => ReviewProgress | undefined,
    private readonly getRestorationNotice: () => string | undefined = () => undefined
  ) {}

  refresh(): void {
    this.changes.fire(undefined);
  }

  getTreeItem(element: ReviewTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ReviewTreeItem): ReviewTreeItem[] {
    const progress = this.getProgress();
    if (progress === undefined) {
      const notice = this.getRestorationNotice();
      const items = [new ReviewTreeItem("No active slice", vscode.TreeItemCollapsibleState.None)];
      if (notice !== undefined) {
        const rejected = new ReviewTreeItem(`Restore rejected — ${notice}`, vscode.TreeItemCollapsibleState.None);
        rejected.tooltip = notice;
        items.push(rejected);
      }
      return items;
    }
    const outline = buildReviewOutline(progress);
    if (element?.scenarioId !== undefined && element.codeRole === undefined) {
      const group = outline.scenarioGroups.find((candidate) => candidate.scenario.id === element.scenarioId);
      if (group === undefined) return [];
      return [
        new ReviewTreeItem(`TEST CODE (${group.testItems.length})`, group.testItems.some((item) => item.current)
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed, {
          iconId: "beaker",
          scenarioId: element.scenarioId,
          codeRole: "test"
        }),
        new ReviewTreeItem(`MAIN CODE (${group.mainItems.length})`, group.mainItems.some((item) => item.current)
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed, {
          iconId: "code",
          scenarioId: element.scenarioId,
          codeRole: "main"
        })
      ];
    }
    if (element?.scenarioId !== undefined && element.codeRole !== undefined) {
      const group = outline.scenarioGroups.find((candidate) => candidate.scenario.id === element.scenarioId);
      if (group === undefined) return [];
      const items = element.codeRole === "test" ? group.testItems : group.mainItems;
      return items.map((reviewItem) => this.reviewItemNode(reviewItem, element.codeRole === "test" ? "beaker" : "code"));
    }
    if (element === undefined) {
      const sections = [
        this.section("Slice intent", "overview", vscode.TreeItemCollapsibleState.Expanded),
        this.section(`Scenarios (${outline.scenarios.length})`, "scenarios", vscode.TreeItemCollapsibleState.Expanded),
        this.section(
          `Review path (${outline.progress.understood} understood, ${outline.progress.skipped} skipped / ${outline.progress.total})`,
          "items",
          vscode.TreeItemCollapsibleState.Collapsed
        )
      ];
      if (outline.questions.length > 0) {
        sections.push(this.section(`Questions (${outline.questions.length})`, "questions", vscode.TreeItemCollapsibleState.Collapsed));
      }
      return sections;
    }
    if (element.id === "overview") {
      const target = outline.items.find((item) => item.current) ?? outline.items[0];
      const item = new ReviewTreeItem(outline.promise, vscode.TreeItemCollapsibleState.None, {
        reviewItem: target,
        iconId: "target",
        showReviewActions: false
      });
      item.tooltip = outline.promise;
      return [item];
    }
    if (element.id === "scenarios") {
      return outline.scenarioGroups.map(({ scenario, mainItems, testItems }) => {
        const containsCurrent = [...mainItems, ...testItems].some((item) => item.current);
        const item = new ReviewTreeItem(
          `${scenario.id} ${scenario.title}`,
          containsCurrent ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
          { iconId: "symbol-event", scenarioId: scenario.id }
        );
        item.tooltip = scenario.behavior;
        return item;
      });
    }
    if (element.id === "items") {
      return outline.items.map((reviewItem) => this.reviewItemNode(reviewItem, reviewItemIcon(reviewItem.status, reviewItem.current)));
    }
    if (element.id === "questions") {
      return outline.questions.map((question) => {
        const target = outline.items.find((item) => item.id === question.itemId);
        const item = new ReviewTreeItem(
          question.text,
          vscode.TreeItemCollapsibleState.None,
          { reviewItem: target, iconId: "comment-discussion", showReviewActions: false }
        );
        item.description = question.itemId;
        return item;
      });
    }
    return [];
  }

  private section(label: string, id: string, state: vscode.TreeItemCollapsibleState): ReviewTreeItem {
    const item = new ReviewTreeItem(label, state);
    item.id = id;
    return item;
  }

  private reviewItemNode(reviewItem: ReviewItem & { current?: boolean }, iconId: string): ReviewTreeItem {
    const item = new ReviewTreeItem(
      reviewItem.intent,
      vscode.TreeItemCollapsibleState.None,
      { reviewItem, iconId }
    );
    item.description = `${reviewItem.current ? "current · " : ""}${reviewItem.codeRole.toUpperCase()} · ${reviewItem.title} · ${reviewItem.kind} · ${reviewItem.scenarioIds.join(", ")}`;
    item.tooltip = new vscode.MarkdownString(
      `**${reviewItem.intent}**\n\n${reviewItem.codeRole.toUpperCase()} · ${reviewItem.title}\n\n${reviewItem.location.path}:${reviewItem.location.line}:${reviewItem.location.column}`
    );
    return item;
  }
}
