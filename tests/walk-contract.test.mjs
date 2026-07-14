import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../walk-contract.js", import.meta.url), "utf8");
const indexSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const serviceWorkerSource = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);

const { SCHEMA_VERSION, normalizeWalkForAi } = context.globalThis.walkContract;
const plain = value => JSON.parse(JSON.stringify(value));

assert.equal(SCHEMA_VERSION, "1.0");
assert.match(indexSource, /<script src="walk-contract\.js\?v=1\.0"><\/script>/);
assert.match(serviceWorkerSource, /"\.\/walk-contract\.js"/);

const observation = "  Motor noise reported.\nPreserve this exactly.  ";
const currentWalk = {
  id: "walk-current",
  version: "1.0",
  status: "completed",
  startedAt: "7/14/2026, 9:00:00 AM",
  endedAt: "7/14/2026, 9:20:00 AM",
  plant: "North Plant",
  inspector: "Inspector One",
  uiExpanded: true,
  indexedDbKey: 42,
  issues: [
    {
      id: "issue-1",
      time: "9:05:00 AM",
      observation,
      workOrderNumber: "WO-001",
      selected: true,
      photos: ["data:image/jpeg;base64,dGVzdA=="]
    },
    { id: "issue-2", time: "9:10:00 AM", observation: "Loose guard", photos: [] }
  ]
};

const normalized = normalizeWalkForAi(currentWalk);
assert.deepEqual(plain(normalized), {
  schemaVersion: "1.0",
  walkId: "walk-current",
  createdAt: "7/14/2026, 9:00:00 AM",
  completedAt: "7/14/2026, 9:20:00 AM",
  site: "North Plant",
  inspector: "Inspector One",
  issues: [
    {
      issueId: "issue-1",
      order: 1,
      observedAt: "9:05:00 AM",
      workOrderNumber: "WO-001",
      observation,
      photos: [{ id: null, reference: "data:image/jpeg;base64,dGVzdA==", mediaType: "image/jpeg", name: null, capturedAt: null }]
    },
    {
      issueId: "issue-2",
      order: 2,
      observedAt: "9:10:00 AM",
      workOrderNumber: null,
      observation: "Loose guard",
      photos: []
    }
  ]
});
assert.equal(normalized.issues[0].observation, observation, "observation content must remain verbatim");
assert.deepEqual(plain(normalized.issues.map(issue => issue.issueId)), ["issue-1", "issue-2"], "array order must be preserved");
assert.equal("status" in normalized, false);
assert.equal("version" in normalized, false);
assert.equal("uiExpanded" in normalized, false);
assert.equal("selected" in normalized.issues[0], false);
assert.equal(Object.isFrozen(normalized), true);
assert.equal(Object.isFrozen(normalized.issues), true);
assert.equal(Object.isFrozen(normalized.issues[0]), true);
assert.equal(Object.isFrozen(normalized.issues[0].photos[0]), true);

assert.throws(() => { normalized.issues[0].photos[0].reference = "changed"; }, /read only|readonly/i);
assert.equal(currentWalk.issues[0].photos[0], "data:image/jpeg;base64,dGVzdA==", "normalization must not mutate its input");
currentWalk.issues[0].observation = "changed after normalization";
assert.equal(normalized.issues[0].observation, observation, "normalized output must not retain mutable input objects");

const legacy = normalizeWalkForAi({
  id: "legacy-walk",
  startedAt: "7/1/2026, 1:00:00 PM",
  endedAt: null,
  issues: [{ id: "legacy-issue", time: "1:04:00 PM", observation: "Legacy note", photos: [] }]
});
assert.deepEqual(plain(legacy), {
  schemaVersion: "1.0",
  walkId: "legacy-walk",
  createdAt: "7/1/2026, 1:00:00 PM",
  completedAt: null,
  site: null,
  inspector: null,
  issues: [{ issueId: "legacy-issue", order: 1, observedAt: "1:04:00 PM", workOrderNumber: null, observation: "Legacy note", photos: [] }]
});

const objectPhoto = normalizeWalkForAi({
  id: "photo-walk",
  issues: [{
    id: "photo-issue",
    observation: "Leak at pump",
    photos: [{ id: "photo-1", dataUrl: "data:image/png;base64,dGVzdA==", mediaType: "image/png", name: "pump.png", capturedAt: "2026-07-14T13:00:00Z", temporaryPreview: true }]
  }]
}).issues[0].photos[0];
assert.deepEqual(plain(objectPhoto), { id: "photo-1", reference: "data:image/png;base64,dGVzdA==", mediaType: "image/png", name: "pump.png", capturedAt: "2026-07-14T13:00:00Z" });

for (const [input, pattern] of [
  [null, /plain object/i],
  [{ issues: [{ id: "issue", observation: "text" }] }, /walk id/i],
  [{ id: "walk", issues: [] }, /at least one issue/i],
  [{ id: "walk", issues: [{ observation: "text" }] }, /issue 1 id/i],
  [{ id: "walk", issues: [{ id: "issue", observation: "" }] }, /observation/i],
  [{ id: "walk", issues: [{ id: "issue", observation: "   " }] }, /observation/i],
  [{ id: "walk", issues: [{ id: "same", observation: "one" }, { id: "same", observation: "two" }] }, /duplicate issue id/i],
  [{ id: "walk", issues: [{ id: "issue", order: 2, observation: "text" }] }, /invalid issue ordering/i],
  [{ id: "walk", issues: [{ id: "issue", observation: "text", photos: {} }] }, /photos must be an array/i],
  [{ id: "walk", issues: [{ id: "issue", observation: "text", photos: ["javascript:alert(1)"] }] }, /unsupported photo reference/i]
]) {
  assert.throws(() => normalizeWalkForAi(input), pattern);
}

console.log("PASS: standardized AI walk contract, legacy normalization, validation, exclusion, ordering, photos, and immutability.");
