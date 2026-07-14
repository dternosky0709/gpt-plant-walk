import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { globalThis: {}, setTimeout, clearTimeout };
for (const file of ["ai-config.js", "walk-contract.js", "prompt-builder.js", "analysis-contract.js", "ai-service.js"]) {
  vm.runInNewContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context);
}
const { createAiService, createConfiguredAiService } = context.globalThis.aiService;
const walk = { id: "walk-e2e", temporaryUiState: true, issues: [
  { id: "issue-a", observation: "Pump seal leaking", uiSelected: true },
  { id: "issue-b", observation: "Panel latch loose", storageKey: "secret" }
] };
const valid = () => ({ schemaVersion: "1.0", walkId: walk.id, provider: "test", model: "test-v1", status: "completed", summary: "Complete", issues: [
  { issueId: "issue-a", order: 1, priority: "high", trade: "Mechanical", recommendation: "Inspect seal" },
  { issueId: "issue-b", order: 2, priority: "medium", trade: "Electrical", recommendation: "Inspect latch" }
] });

{
  let received;
  const service = createAiService({ provider: { analyzeWalk: async request => { received = request; return valid(); } } });
  const result = await service.analyzeWalk(walk);
  assert.equal(received.metadata.walkId, walk.id);
  assert.equal(JSON.stringify(received).includes("temporaryUiState"), false);
  assert.equal(JSON.stringify(received).includes("uiSelected"), false);
  assert.deepEqual(Array.from(result.issues, issue => issue.issueId), ["issue-a", "issue-b"]);
  assert.equal(Object.hasOwn(result, "messages"), false, "application result must not expose provider request data");
  assert.equal(Object.isFrozen(result), true);
}

{
  const original = new Error("provider failed");
  let calls = 0;
  const service = createAiService({ provider: { analyzeWalk: async () => { calls += 1; throw original; } } });
  await assert.rejects(service.analyzeWalk(walk), error => error === original);
  assert.equal(calls, 1);
}

{
  let calls = 0;
  const service = createAiService({
    provider: { analyzeWalk: async () => { calls += 1; if (calls === 1) throw new Error("transient"); return valid(); } },
    runtimeConfig: { retryCount: 1, requestTimeoutMs: 100 }
  });
  assert.equal((await service.analyzeWalk(walk)).status, "completed");
  assert.equal(calls, 2);
}

{
  let calls = 0;
  const finalError = new Error("still unavailable");
  const service = createAiService({
    provider: { analyzeWalk: async () => { calls += 1; throw finalError; } },
    runtimeConfig: { retryCount: 2, requestTimeoutMs: 100 }
  });
  await assert.rejects(service.analyzeWalk(walk), error => error === finalError);
  assert.equal(calls, 3, "attempts must equal the initial call plus configured retries");
}

{
  let calls = 0;
  const service = createAiService({
    provider: { analyzeWalk: () => { calls += 1; return new Promise(() => {}); } },
    runtimeConfig: { retryCount: 1, requestTimeoutMs: 5 }
  });
  await assert.rejects(service.analyzeWalk(walk), error => error.name === "AiTimeoutError" && error.code === "AI_TIMEOUT");
  assert.equal(calls, 2);
}

{
  const invalid = valid();
  invalid.issues.reverse();
  const service = createAiService({ provider: { analyzeWalk: async () => invalid } });
  await assert.rejects(service.analyzeWalk(walk), /order and identity/i);
}

{
  const result = await createConfiguredAiService({ requestTimeoutMs: 100 }).analyzeWalk(walk);
  assert.equal(result.schemaVersion, "1.0");
  assert.equal(result.provider, "mock");
  assert.deepEqual(Array.from(result.issues, issue => issue.order), [1, 2]);
}

console.log("PASS: full mock AI workflow, response boundary, errors, timeout, and retry behavior.");
