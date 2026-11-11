import type { ReviewItem, ReviewItemStatus, ReviewProgress, SliceScenario } from "../protocol/types.js";

export interface ReviewOutlineItem extends ReviewItem {
  status: ReviewItemStatus;
  current: boolean;
}

export interface ReviewOutline {
  title: string;
  promise: string;
  scenarios: SliceScenario[];
  scenarioGroups: Array<{
    scenario: SliceScenario;
    mainItems: ReviewOutlineItem[];
    testItems: ReviewOutlineItem[];
  }>;
  progress: { understood: number; skipped: number; total: number; complete: boolean };
  items: ReviewOutlineItem[];
  questions: ReviewProgress["questions"];
}

export function reviewItemIcon(status: ReviewItemStatus, current: boolean): string {
  if (status === "understood") return "check";
  if (status === "skipped") return "debug-step-over";
  return current ? "arrow-right" : "circle-outline";
}

export function reviewViewTitle(progress: ReviewProgress | undefined): string {
  return progress?.descriptor.title ?? "Active Slice";
}

export function buildReviewOutline(progress: ReviewProgress): ReviewOutline {
  const understood = Object.values(progress.itemStatuses).filter((status) => status === "understood").length;
  const skipped = Object.values(progress.itemStatuses).filter((status) => status === "skipped").length;
  const total = progress.descriptor.items.length;
  const items: ReviewOutlineItem[] = progress.descriptor.items.map((item) => ({
    ...item,
    status: progress.itemStatuses[item.id] ?? "unviewed",
    current: item.id === progress.currentItemId
  }));
  return {
    title: progress.descriptor.title,
    promise: progress.descriptor.promise,
    scenarios: progress.descriptor.scenarios,
    scenarioGroups: progress.descriptor.scenarios.map((scenario) => ({
      scenario,
      mainItems: items.filter((item) => item.codeRole === "main" && item.scenarioIds.includes(scenario.id)),
      testItems: items.filter((item) => item.codeRole === "test" && item.scenarioIds.includes(scenario.id))
    })),
    progress: {
      understood,
      skipped,
      total,
      complete: understood + skipped === total
    },
    items,
    questions: progress.questions
  };
}
