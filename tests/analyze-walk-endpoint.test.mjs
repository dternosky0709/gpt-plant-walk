import assert from "node:assert/strict";
import handler, { endpointInternals } from "../api/analyze-walk.js";

const SYSTEM_INSTRUCTIONS = globalThis.promptBuilder.SYSTEM_INSTRUCTIONS;

function request(overrides = {}) {
  return { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `test-${Math.random()}` }, body: validRequest(), ...overrides };
}

function validRequest() {
  const walk = { schemaVersion: "1.0", walkId: "walk-api", createdAt: null, completedAt: null, site: null, inspector: null, issues: [
    { issueId: "issue-1", order: 1, observedAt: null, workOrderNumber: null, observation: "Pump seal leaking", photos: [] }
  ] };
  return { promptSchemaVersion: "1.0", model: "mock-v1", maxOutputTokens: 512, messages: [
    { role: "system", content: SYSTEM_INSTRUCTIONS },
    { role: "user", content: `Analyze this normalized GPT Plant Walk contract. Return analysis for this walk only.\n${JSON.stringify(walk)}` }
  ], metadata: { walkId: "walk-api", walkSchemaVersion: "1.0", promptSchemaVersion: "1.0", issueCount: 1 } };
}

async function invoke(req) {
  const headers = {};
  let statusCode;
  let output;
  const response = { setHeader(name, value) { headers[name] = value; }, status(value) { statusCode = value; return this; }, json(value) { output = value; return this; } };
  await handler(req, response);
  return { statusCode, output, headers };
}

assert.equal((await invoke(request({ method: "GET" }))).statusCode, 405);
assert.equal((await invoke(request({ headers: { "content-type": "text/plain", "x-forwarded-for": "content-type" } }))).statusCode, 415);
assert.equal((await invoke(request({ headers: { "content-type": "application/json", "content-length": String(endpointInternals.MAX_REQUEST_BYTES + 1), "x-forwarded-for": "large" } }))).statusCode, 413);
assert.equal((await invoke(request({ body: "{broken" }))).output.error.code, "MALFORMED_JSON");
assert.equal((await invoke(request({ body: { promptSchemaVersion: "2.0" } }))).output.error.code, "INVALID_REQUEST");

const first = await invoke(request());
const second = await invoke(request());
assert.equal(first.statusCode, 200);
assert.deepEqual(first.output, second.output);
assert.equal(first.output.provider, "mock-server");
assert.equal(first.output.issues[0].issueId, "issue-1");
assert.equal(first.headers["Cache-Control"], "no-store");

const original = globalThis.analysisContract.validateAnalysisResult;
const originalConsoleError = console.error;
console.error = () => {};
globalThis.analysisContract = { ...globalThis.analysisContract, validateAnalysisResult() { throw new Error("private detail"); } };
const failed = await invoke(request());
globalThis.analysisContract = { ...globalThis.analysisContract, validateAnalysisResult: original };
console.error = originalConsoleError;
assert.equal(failed.statusCode, 500);
assert.deepEqual(failed.output, { error: { code: "INTERNAL_ERROR", message: "The analysis request could not be completed." } });
assert.equal(JSON.stringify(failed.output).includes("private detail"), false);

console.log("PASS: secure mock analysis endpoint validation, deterministic response, limits, and safe errors.");
