import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../planner-sync.js", import.meta.url), "utf8");
const context = {
  crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
  Date,
  Math,
  globalThis: null
};
context.globalThis = context;
vm.runInNewContext(source, context);

const walk = { id: "walk-1", issues: [] };
const issue = {
  id: "observation-1",
  workOrderId: "WO-2026-001",
  observedAt: "2026-08-10T12:00:00.000Z",
  observation: "Kiln fan bearing is noisy.",
  initialPriority: "Planned",
  photos: ["data:image/jpeg;base64,abc", "data:image/jpeg;base64,def"]
};
const payload = context.plannerSync.buildIntakePayload({ walk, issue, plantName: "Canton Plant", sentAt: "2026-08-10T12:05:00.000Z" });

assert.equal(payload.contractVersion, "1.0");
assert.equal(payload.eventId, "evt-00000000-0000-4000-8000-000000000001");
assert.equal(payload.source.plantWalkId, "walk-1");
assert.equal(payload.source.observationId, "observation-1");
assert.equal(payload.source.plantId, "CANTON-PLANT");
assert.equal(payload.workOrder.id, "WO-2026-001");
assert.equal(payload.observation.text, issue.observation);
assert.equal(payload.observation.photoReferences.length, 2);
assert.equal("url" in payload.observation.photoReferences[0], false, "device-local photo data must not be exposed as an expiring URL");

assert.deepEqual(
  JSON.parse(JSON.stringify(context.plannerSync.summarizeWalkSync({ issues: [{ syncStatus: "synced" }, { syncStatus: "pending_sync" }, { syncStatus: "sync_failed" }] }))),
  { total: 3, synced: 1, pending: 1, failed: 1, notQueued: 0 }
);
assert.equal(context.plannerSync.nextRetryAt(1, 0), "1970-01-01T00:00:30.000Z");
assert.equal(
  context.plannerSync.ensureGlobalWorkOrderId("WO-20260811-001", "12345678-90ab-4def-8123-4567890abcde"),
  "WO-20260811-001-1234567890AB"
);
assert.equal(
  context.plannerSync.ensureGlobalWorkOrderId("WO-20260811-001-1234567890AB", "12345678-90ab-4def-8123-4567890abcde"),
  "WO-20260811-001-1234567890AB",
  "global work-order identity must be stable across retries"
);
assert.equal(
  context.plannerSync.displayWorkOrderId("WO-20260811-001-1234567890AB"),
  "WO-20260811-001",
  "the collision-proof suffix must stay hidden from the operator-facing work-order number"
);
assert.equal(context.plannerSync.displayWorkOrderId("WO-2026-0142"), "WO-2026-0142");

console.log("PASS: Plant Walk creates stable Planner intake payloads and retry state.");
