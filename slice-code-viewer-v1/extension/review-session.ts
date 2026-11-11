import type * as vscode from "vscode";

import { askQuestion, createReviewProgress, eventsAfter, markItem, restoreReviewProgress } from "../protocol/review-state.js";
import type { ReviewDescriptor, ReviewEvent, ReviewProgress } from "../protocol/types.js";

const storageKey = "codexSliceReview.activeReview.v1";

export class ReviewSession {
  private progress: ReviewProgress | undefined;
  readonly restorationNotice: string | undefined;

  constructor(
    private readonly workspaceId: string,
    readonly connectionId: string,
    private readonly workspaceState: vscode.Memento,
    private readonly onChange: () => void
  ) {
    const restoration = restoreReviewProgress(workspaceState.get(storageKey), workspaceId);
    if (restoration.status === "restored") this.progress = restoration.progress;
    if (restoration.status === "rejected") this.restorationNotice = restoration.message;
  }

  get current(): ReviewProgress | undefined {
    return this.progress;
  }

  async load(descriptor: ReviewDescriptor): Promise<void> {
    this.progress = createReviewProgress(descriptor);
    await this.persist();
  }

  async markUnderstood(itemId: string): Promise<void> {
    const progress = this.requireProgress();
    if (markItem(progress, itemId, "understood") !== undefined) await this.persist();
  }

  async skip(itemId: string): Promise<void> {
    const progress = this.requireProgress();
    if (markItem(progress, itemId, "skipped") !== undefined) await this.persist();
  }

  async ask(itemId: string, text: string): Promise<void> {
    const progress = this.requireProgress();
    askQuestion(progress, itemId, text);
    await this.persist();
  }

  eventsAfter(sequence: number): ReviewEvent[] {
    return this.progress === undefined ? [] : eventsAfter(this.progress, sequence);
  }

  private requireProgress(): ReviewProgress {
    if (this.progress === undefined) throw new Error("no active slice review");
    return this.progress;
  }

  private async persist(): Promise<void> {
    await this.workspaceState.update(storageKey, this.progress);
    this.onChange();
  }
}
