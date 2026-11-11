import assert from "node:assert/strict";
import test from "node:test";

import { InventoryLedger } from "../src/inventory-ledger.js";
import { ReservationService } from "../src/reservation-service.js";

/*
 * SPECIFICATION TESTS
 *
 * These tests are the reader-first executable specification of reservation
 * safety. Defensive input and conflict variants belong in coverage tests.
 */

test("DEMO.1 sufficient stock is reserved and reported", () => {
  const inventory = new InventoryLedger({ book: 3, pen: 5 });
  const service = new ReservationService(inventory);

  const result = service.reserve({
    requestId: "request-1",
    lines: [{ sku: "book", quantity: 2 }, { sku: "pen", quantity: 1 }]
  });

  assert.equal(result.status, "reserved");
  assert.equal(inventory.available("book"), 1);
  assert.equal(inventory.available("pen"), 4);
});

test("DEMO.2 retrying the same request returns its confirmation without consuming stock twice", () => {
  const inventory = new InventoryLedger({ book: 3 });
  const service = new ReservationService(inventory);
  const request = { requestId: "request-2", lines: [{ sku: "book", quantity: 2 }] };

  const first = service.reserve(request);
  const retry = service.reserve(request);

  assert.deepEqual(retry, first);
  assert.equal(inventory.available("book"), 1);
});

test("DEMO.3 insufficient stock rejects the whole request without partial consumption", () => {
  const inventory = new InventoryLedger({ book: 3, pen: 1 });
  const service = new ReservationService(inventory);

  const result = service.reserve({
    requestId: "request-3",
    lines: [{ sku: "book", quantity: 2 }, { sku: "pen", quantity: 2 }]
  });

  assert.deepEqual(result, { status: "rejected", shortages: [{ sku: "pen", quantity: 2 }] });
  assert.equal(inventory.available("book"), 3);
  assert.equal(inventory.available("pen"), 1);
});
