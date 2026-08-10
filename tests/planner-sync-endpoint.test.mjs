import assert from "node:assert/strict";

const module = await import(`../api/sync-maintenance-planner.js?test=${Date.now()}`);
const validPayload = {
  contractVersion: "1.0",
  eventId: "evt-1",
  sentAt: "2026-08-10T12:05:00.000Z",
  source: { application: "plant-walk", deployment: "production", plantWalkId: "walk-1", observationId: "observation-1" },
  workOrder: { id: "WO-2026-001", title: "Noisy fan bearing", initialPriority: "Planned" },
  observation: { text: "Kiln fan bearing is noisy.", observedAt: "2026-08-10T12:00:00.000Z", photoReferences: [{ photoId: "photo-1" }] }
};

assert.equal(module.endpointInternals.validatePayload(validPayload), true);
assert.equal(module.endpointInternals.validatePayload({ ...validPayload, workOrder: { ...validPayload.workOrder, id: "bad/id" } }), false);
assert.equal(module.endpointInternals.validatePayload({ ...validPayload, source: { ...validPayload.source, application: "unknown" } }), false);

function responseHarness() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

const previousToken = process.env.PLANT_WALK_INTAKE_TOKEN;
process.env.PLANT_WALK_INTAKE_TOKEN = "test-token-that-is-longer-than-thirty-two-characters";
const previousFetch = global.fetch;
global.fetch = async (url, options) => {
  assert.match(String(url), /api\/v1\/work-orders\/intake$/);
  assert.equal(options.headers["x-plant-walk-token"], process.env.PLANT_WALK_INTAKE_TOKEN);
  return { status: 201, async json() { return { contractVersion: "1.0", eventId: validPayload.eventId, intakeStatus: "accepted", workOrderId: validPayload.workOrder.id, acceptedAt: "2026-08-10T12:05:01.000Z" }; } };
};

const response = responseHarness();
await module.default({ method: "POST", headers: { "content-type": "application/json" }, body: validPayload }, response);
assert.equal(response.statusCode, 201);
assert.equal(response.body.intakeStatus, "accepted");
assert.equal(response.body.workOrderId, validPayload.workOrder.id);

global.fetch = previousFetch;
if (previousToken === undefined) delete process.env.PLANT_WALK_INTAKE_TOKEN;
else process.env.PLANT_WALK_INTAKE_TOKEN = previousToken;

console.log("PASS: Plant Walk Planner proxy validates and forwards work orders without exposing credentials.");
