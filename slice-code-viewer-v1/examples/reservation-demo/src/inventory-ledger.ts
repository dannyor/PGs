import type { ReservationLine } from "./types.js";

export class InventoryLedger {
  private readonly availableBySku: Map<string, number>;

  constructor(initialStock: Record<string, number>) {
    this.availableBySku = new Map(Object.entries(initialStock));
  }

  available(sku: string): number {
    return this.availableBySku.get(sku) ?? 0;
  }

  shortages(lines: ReservationLine[]): ReservationLine[] {
    return this.totalBySku(lines).filter((line) => this.available(line.sku) < line.quantity);
  }

  reserveAll(lines: ReservationLine[]): boolean {
    const totals = this.totalBySku(lines);
    if (this.shortages(totals).length > 0) return false;
    for (const line of totals) {
      this.availableBySku.set(line.sku, this.available(line.sku) - line.quantity);
    }
    return true;
  }

  private totalBySku(lines: ReservationLine[]): ReservationLine[] {
    const totals = new Map<string, number>();
    for (const line of lines) totals.set(line.sku, (totals.get(line.sku) ?? 0) + line.quantity);
    return [...totals].map(([sku, quantity]) => ({ sku, quantity }));
  }
}
