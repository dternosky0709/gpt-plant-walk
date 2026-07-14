import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../ai-service.js", import.meta.url), "utf8");
const contractSource = fs.readFileSync(new URL("../walk-contract.js", import.meta.url), "utf8");
const promptSource = fs.readFileSync(new URL("../prompt-builder.js", import.meta.url), "utf8");
const indexSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const serviceWorkerSource = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(contractSource, context);
vm.runInNewContext(promptSource, context);
vm.runInNewContext(source, context);

assert.match(indexSource, /<script src="walk-contract\.js\?v=1\.0"><\/script>\s*<script src="prompt-builder\.js\?v=1\.0"><\/script>\s*<script src="ai-service\.js\?v=1\.0"><\/script>/, "the request contract must load before the AI service layer");
assert.match(serviceWorkerSource, /"\.\/prompt-builder\.js"/, "the prompt builder must remain available offline");
assert.match(serviceWorkerSource, /"\.\/ai-service\.js"/, "the AI service layer must remain available offline");

const { createAiService, createMockAiProvider } = context.globalThis.aiService;
const walk = {
  id: "walk-1",
  issues: [
    { id: "issue-1", observation: "Motor is noisy", photos: ["data:image/png;base64,dGVzdA=="] },
    { id: "issue-2", observation: "Guard is loose", photos: [] }
  ]
};

{
  let receivedRequest = null;
  const expected = { walkId: walk.id, findings: [], marker: "delegated" };
  const service = createAiService({
    provider: {
      async analyzeWalk(input) {
        receivedRequest = input;
        return expected;
      }
    }
  });

  const result = await service.analyzeWalk(walk);
  assert.notEqual(receivedRequest, walk, "the service must not delegate raw application data");
  assert.equal(receivedRequest.metadata.walkId, walk.id, "the service must delegate the provider-ready request");
  assert.equal(receivedRequest.promptSchemaVersion, "1.0");
  assert.equal(result, expected, "the service must return the provider analysis");
}

assert.throws(() => createAiService(), /provider.*analyzeWalk/i);
assert.throws(() => createAiService({ provider: {} }), /provider.*analyzeWalk/i);

{
  const service = createAiService({ provider: createMockAiProvider() });
  await assert.rejects(service.analyzeWalk(null), /walk.*plain object/i);
  await assert.rejects(service.analyzeWalk({ id: "", issues: [] }), /walk id/i);
  await assert.rejects(service.analyzeWalk({ id: "walk-1" }), /issues must be an array/i);
}

{
  const providerError = new Error("provider unavailable");
  const service = createAiService({ provider: { analyzeWalk: async () => { throw providerError; } } });
  await assert.rejects(service.analyzeWalk(walk), error => error === providerError);
}

for (const invalidAnalysis of [null, {}, { walkId: walk.id, findings: null }]) {
  const service = createAiService({ provider: { analyzeWalk: async () => invalidAnalysis } });
  await assert.rejects(service.analyzeWalk(walk), /analysis|findings/i);
}

{
  const service = createAiService({ provider: { analyzeWalk: async () => ({ walkId: "another-walk", findings: [] }) } });
  await assert.rejects(service.analyzeWalk(walk), /walkId must match/i);
}

{
  const service = createAiService({ provider: createMockAiProvider() });
  const result = await service.analyzeWalk(walk);
  assert.equal(result.walkId, walk.id);
  assert.equal(result.provider, "mock");
  assert.equal(result.status, "mock");
  assert.match(result.summary, /No hosted AI request was made/);
  assert.deepEqual(Array.from(result.findings, finding => ({
    issueId: finding.issueId,
    sequence: finding.sequence,
    observation: finding.observation
  })), [
    { issueId: "issue-1", sequence: 1, observation: "Motor is noisy" },
    { issueId: "issue-2", sequence: 2, observation: "Guard is loose" }
  ]);
}

console.log("PASS: provider-agnostic AI service contract, validation, delegation, errors, and mock behavior.");
