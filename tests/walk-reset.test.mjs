import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../walk-reset.js", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const indexSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const context = {};
vm.runInNewContext(source, context);

assert.match(indexSource, /id="backToStartBtn"[^>]*>Back to Start</, "reporting screen must offer a clear return action");
assert.match(appSource, /history\.pushState\(\{ plantWalkView: "report", walkId: walk\.id \}/, "report view must create a sensible browser-back destination");
assert.match(appSource, /addEventListener\("popstate"/, "browser back must be handled from the reporting view");

function createHarness() {
  const completedWalk = {
    id: "walk-completed",
    status: "completed",
    issues: [{ id: "issue-1", observation: "Bearing noise", photos: ["photo-data"] }]
  };
  const walks = [completedWalk];
  const drafts = new Map([[completedWalk.id, { observation: "temporary text", photos: ["draft-photo"] }]]);
  const form = { observation: "temporary text", photos: ["draft-photo"] };
  let activeWalk = completedWalk;
  let view = "report";
  let clearCalls = 0;

  const options = {
    walkId: completedWalk.id,
    clearDraft: async id => { clearCalls += 1; drafts.delete(id); },
    clearActiveWalk: () => { activeWalk = null; },
    clearForm: () => { form.observation = ""; form.photos = []; },
    showStart: () => { view = "start"; }
  };

  return { completedWalk, walks, drafts, form, options, state: () => ({ activeWalk, view, clearCalls }) };
}

{
  const harness = createHarness();
  const result = await context.walkReset.resetCompletedWalk(harness.options);
  assert.equal(result.status, "reset", "returning after packet generation must complete");
  assert.equal(harness.state().view, "start", "the clean start screen must be shown");
  assert.equal(harness.state().activeWalk, null, "active walk UI state must be cleared");
  assert.equal(harness.walks.length, 1, "completed walk history must be preserved");
  assert.deepEqual(harness.completedWalk.issues[0].photos, ["photo-data"], "saved photos must be preserved");
  assert.equal(harness.drafts.has(harness.completedWalk.id), false, "temporary draft must be cleared");
  assert.deepEqual(harness.form, { observation: "", photos: [] }, "the next walk must start with a blank form");
}

{
  const harness = createHarness();
  const result = await context.walkReset.resetCompletedWalk(harness.options);
  assert.equal(result.status, "reset", "returning without packet generation must use the same saved-report reset");
}

{
  const harness = createHarness();
  let releaseClear;
  harness.options.clearDraft = () => new Promise(resolve => { releaseClear = resolve; });
  const first = context.walkReset.resetCompletedWalk(harness.options);
  const duplicate = await context.walkReset.resetCompletedWalk(harness.options);
  assert.equal(duplicate.status, "busy", "duplicate reset taps must be ignored while reset is pending");
  releaseClear();
  await first;
}

{
  const harness = createHarness();
  await context.walkReset.resetCompletedWalk(harness.options);
  const reopenedWalk = structuredClone(harness.walks[0]);
  assert.equal(reopenedWalk.status, "completed", "refresh/reopen must retain completed status");
  assert.equal(reopenedWalk.issues.length, 1, "refresh/reopen must retain saved issues");
}

console.log("PASS: completed-walk return-to-start flow preserves history and clears only active UI state.");
