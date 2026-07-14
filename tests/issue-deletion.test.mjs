import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../issue-deletion.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const { deleteSavedIssue } = context.globalThis.issueDeletion;

const makeIssue = number => ({ id: `issue-${number}`, observation: `Observation ${number}`, photos: [`photo-${number}`] });
const makeWalk = count => ({ id: "walk-1", issues: Array.from({ length: count }, (_, index) => makeIssue(index + 1)) });

async function deleteFrom(walk, issueId) {
  let persisted = null;
  const result = await deleteSavedIssue({
    walk,
    issueId,
    confirmDelete: () => true,
    persist: async () => { persisted = JSON.parse(JSON.stringify(walk)); }
  });
  return { result, persisted };
}

for (const [label, issueId, expected] of [
  ["first", "issue-1", ["issue-2", "issue-3"]],
  ["middle", "issue-2", ["issue-1", "issue-3"]],
  ["last", "issue-3", ["issue-1", "issue-2"]],
  ["only", "issue-1", []]
]) {
  const walk = makeWalk(label === "only" ? 1 : 3);
  const { result } = await deleteFrom(walk, issueId);
  assert.equal(result.status, "deleted", `${label} issue should delete`);
  assert.deepEqual(walk.issues.map(issue => issue.id), expected, `${label} deletion should preserve remaining order`);
}

{
  const walk = makeWalk(2);
  let persisted = false;
  const result = await deleteSavedIssue({ walk, issueId: "issue-1", confirmDelete: () => false, persist: async () => { persisted = true; } });
  assert.equal(result.status, "cancelled");
  assert.deepEqual(walk.issues.map(issue => issue.id), ["issue-1", "issue-2"]);
  assert.equal(persisted, false, "cancelled deletion must not persist");
}

{
  const walk = makeWalk(3);
  const { persisted } = await deleteFrom(walk, "issue-2");
  const reopenedWalk = JSON.parse(JSON.stringify(persisted));
  assert.deepEqual(reopenedWalk.issues.map(issue => issue.id), ["issue-1", "issue-3"], "deleted issue must stay deleted after reopen");
  assert.deepEqual(reopenedWalk.issues.map(issue => issue.photos[0]), ["photo-1", "photo-3"], "remaining photos must stay associated after reopen");
  assert.deepEqual(reopenedWalk.issues.map((issue, index) => ({ number: index + 1, photo: issue.photos[0] })), [
    { number: 1, photo: "photo-1" },
    { number: 2, photo: "photo-3" }
  ], "packet input order and numbering must follow the remaining issue order");

  const packetSource = fs.readFileSync(new URL("../pdfbolt.js", import.meta.url), "utf8");
  const packetContext = {
    document: { getElementById: () => null },
    localStorage: { getItem: () => null },
    console,
    Date,
    JSON,
    window: null
  };
  packetContext.window = packetContext;
  vm.runInNewContext(packetSource, packetContext);
  const packet = packetContext.buildPlantWalkPacket({ ...reopenedWalk, startedAt: "2026-07-14T09:00:00" });
  assert.equal(packet.report.totalIssues, 2, "packet issue count must reflect deletion");
  assert.deepEqual(Array.from(packet.issues, issue => issue.sequence), [1, 2], "packet issues must be renumbered");
  assert.deepEqual(Array.from(packet.issues, issue => issue.originalObservation), ["Observation 1", "Observation 3"], "packet order must exclude only the deleted issue");
  assert.deepEqual(Array.from(packet.issues, issue => issue.photos[0].url), ["photo-1", "photo-3"], "packet photos must remain associated");
}

{
  const walk = makeWalk(3);
  let releasePersist;
  const first = deleteSavedIssue({ walk, issueId: "issue-2", confirmDelete: () => true, persist: () => new Promise(resolve => { releasePersist = resolve; }) });
  const second = await deleteSavedIssue({ walk, issueId: "issue-1", confirmDelete: () => true, persist: async () => {} });
  assert.equal(second.status, "busy", "a second delete must be ignored while persistence is pending");
  releasePersist();
  await first;
}

{
  const walk = makeWalk(3);
  await assert.rejects(
    deleteSavedIssue({ walk, issueId: "issue-2", confirmDelete: () => true, persist: async () => { throw new Error("storage failed"); } }),
    /storage failed/
  );
  assert.deepEqual(walk.issues.map(issue => issue.id), ["issue-1", "issue-2", "issue-3"], "failed persistence must restore the issue in place");
}

console.log("Issue deletion behavior: PASS");
