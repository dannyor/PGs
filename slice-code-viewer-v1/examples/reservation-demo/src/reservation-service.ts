import { createHash } from "node:crypto";

import { InventoryLedger } from "./inventory-ledger.js";
import type { ReservationConfirmation, ReservationRequest, ReservationResult } from "./types.js";

interface RecordedRequest {
  fingerprint: string;
  confirmation: ReservationConfirmation;
}

export class ReservationService {
  private readonly recordedByRequestId = new Map<string, RecordedRequest>();

  constructor(private readonly inventory: InventoryLedger) {}

  reserve(request: ReservationRequest): ReservationResult {
    const fingerprint = this.fingerprint(request);
    const recorded = this.recordedByRequestId.get(request.requestId);
    if (recorded !== undefined) {
      return recorded.fingerprint === fingerprint
        ? { status: "reserved", confirmation: recorded.confirmation }
        : { status: "conflict", message: "request ID was already used with different content" };
    }

    const shortages = this.inventory.shortages(request.lines);
    if (shortages.length > 0) return { status: "rejected", shortages };

    this.inventory.reserveAll(request.lines);
    const confirmation: ReservationConfirmation = {
      reservationId: `reservation-${request.requestId}`,
      requestId: request.requestId,
      lines: request.lines.map((line) => ({ ...line }))
    };
    this.recordedByRequestId.set(request.requestId, { fingerprint, confirmation });
    return { status: "reserved", confirmation };
  }

  private fingerprint(request: ReservationRequest): string {
    const canonicalLines = [...request.lines].sort((left, right) => left.sku.localeCompare(right.sku));
    return createHash("sha256").update(JSON.stringify(canonicalLines)).digest("hex");
  }
}
