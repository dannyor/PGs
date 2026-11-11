import assert from "node:assert/strict";
import test from "node:test";

import { InventoryLedger } from "../src/inventory-ledger.js";
import { ReservationService } from "../src/reservation-service.js";

test("coverage for DEMO.2: reusing a request ID with different content is a conflict", () => {
  const inventory = new InventoryLedger({ book: 5 });
  const service = new ReservationService(inventory);
  service.reserve({ requestId: "same-id", lines: [{ sku: "book", quantity: 1 }] });

  const conflict = service.reserve({ requestId: "same-id", lines: [{ sku: "book", quantity: 2 }] });

  assert.deepEqual(conflict, {
    status: "conflict",
    message: "request ID was already used with different content"
  });
  assert.equal(inventory.available("book"), 4);
});

test("coverage for DEMO.3: duplicate SKU lines are aggregated before shortage decisions", () => {
  const inventory = new InventoryLedger({ book: 3 });
  const service = new ReservationService(inventory);

  const result = service.reserve({
    requestId: "duplicate-lines",
    lines: [{ sku: "book", quantity: 2 }, { sku: "book", quantity: 2 }]
  });

  assert.deepEqual(result, { status: "rejected", shortages: [{ sku: "book", quantity: 4 }] });
  assert.equal(inventory.available("book"), 3);
});
