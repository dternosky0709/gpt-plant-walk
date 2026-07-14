import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const configSource = fs.readFileSync(new URL("../ai-config.js", import.meta.url), "utf8");
const serviceSource = fs.readFileSync(new URL("../ai-service.js", import.meta.url), "utf8");
const contractSource = fs.readFileSync(new URL("../walk-contract.js", import.meta.url), "utf8");
const promptSource = fs.readFileSync(new URL("../prompt-builder.js", import.meta.url), "utf8");
const analysisSource = fs.readFileSync(new URL("../analysis-contract.js", import.meta.url), "utf8");
const indexSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const serviceWorkerSource = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const context = { globalThis: {}, setTimeout, clearTimeout };
vm.runInNewContext(configSource, context);
vm.runInNewContext(contractSource, context);
vm.runInNewContext(promptSource, context);
vm.runInNewContext(analysisSource, context);
vm.runInNewContext(serviceSource, context);

const { DEFAULTS, createAiConfig } = context.globalThis.aiConfig;
const { createConfiguredAiService } = context.globalThis.aiService;

assert.match(indexSource, /<script src="ai-config\.js\?v=1\.0"><\/script>\s*<script src="walk-contract\.js\?v=1\.0"><\/script>\s*<script src="prompt-builder\.js\?v=1\.0"><\/script>\s*<script src="analysis-contract\.js\?v=1\.0"><\/script>\s*<script src="ai-service\.js\?v=1\.0"><\/script>/,
  "configuration must load before the AI service");
assert.match(serviceWorkerSource, /"\.\/ai-config\.js"/, "configuration must remain available offline");

{
  const config = createAiConfig();
  assert.deepEqual(JSON.parse(JSON.stringify(config)), {
    providerMode: "mock",
    model: "mock-v1",
    requestTimeoutMs: 30000,
    retryCount: 0,
    retryPolicy: "none",
    maxOutputTokens: 4096,
    debug: false,
    apiEndpoint: null,
    featureFlags: {}
  });
  assert.equal(Object.isFrozen(config), true);
  assert.equal(Object.isFrozen(config.featureFlags), true);
  assert.equal(Object.isFrozen(DEFAULTS), true);
}

{
  const overrides = {
    model: "future-model",
    requestTimeoutMs: 12000,
    retryCount: 2,
    retryPolicy: "exponential",
    maxOutputTokens: 2048,
    debug: true,
    apiEndpoint: "/api/analyze",
    featureFlags: { photoAnalysis: true }
  };
  const config = createAiConfig(overrides);
  overrides.featureFlags.photoAnalysis = false;
  assert.equal(config.providerMode, "mock", "unspecified defaults must survive safe merging");
  assert.equal(config.model, "future-model");
  assert.equal(config.featureFlags.photoAnalysis, true, "nested configuration must not retain mutable input");
}

for (const invalid of [
  null,
  { providerMode: "" },
  { model: "" },
  { requestTimeoutMs: 0 },
  { retryCount: -1 },
  { retryCount: 1, retryPolicy: "none" },
  { retryPolicy: "sometimes" },
  { maxOutputTokens: 0 },
  { debug: "yes" },
  { apiEndpoint: "" },
  { featureFlags: [] },
  { featureFlags: { photoAnalysis: "yes" } }
]) {
  assert.throws(() => createAiConfig(invalid), /configuration|feature flag/i);
}

{
  const service = createConfiguredAiService({ model: "mock-test", featureFlags: { photoAnalysis: false } });
  const result = await service.analyzeWalk({ id: "walk-config", issues: [{ id: "issue-config", observation: "Test observation" }] });
  assert.equal(result.provider, "mock");
  assert.equal(result.status, "completed");
}

assert.throws(() => createConfiguredAiService({ providerMode: "live" }), /only mock/i,
  "future modes must not activate a network runtime path");

console.log("PASS: centralized AI configuration defaults, overrides, validation, immutability, and integration.");
