# Reservation demo

This example exists to exercise the MS1 intent-centered review workflow with a small but behaviorally rich system.

## Slice intent

Reserve inventory exactly once for a retried request, and never partially consume stock when the full request cannot be satisfied.

## Primary scenarios

- **DEMO.1 — Successful reservation:** sufficient stock produces a confirmation and decrements every requested SKU.
- **DEMO.2 — Idempotent retry:** repeating the same request ID and content returns the original confirmation without decrementing stock again.
- **DEMO.3 — Atomic rejection:** insufficient stock returns the shortages and leaves all inventory unchanged.

## Review shape

The review connects each scenario to reader-first specification evidence and then to the types, inventory ownership boundary, and reservation orchestration that realize the declared intent.
