import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const contractSource = fs.readFileSync(new URL("../walk-contract.js", import.meta.url), "utf8");
const builderSource = fs.readFileSync(new URL("../prompt-builder.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(contractSource, context);
vm.runInNewContext(builderSource, context);

const { normalizeWalkForAi } = context.globalThis.walkContract;
const { PROMPT_SCHEMA_VERSION, SYSTEM_INSTRUCTIONS, buildPromptRequest } = context.globalThis.promptBuilder;
const observation = "  Belt says </script> & \\\"quoted\\\".\nSecond line: 😀  ";
const raw = {
  id: "walk-edge",
  uiState: "forbidden",
  issues: [
    { id: "issue-b", observation, workOrderNumber: "WO-<42>", selected: true, photos: [] },
    { id: "issue-a", observation: "Guard loose", photos: [] }
  ]
};
const normalized = normalizeWalkForAi(raw);
const request = buildPromptRequest(normalized, { model: "mock-v1", maxOutputTokens: 512 });
const repeated = buildPromptRequest(normalized, { model: "mock-v1", maxOutputTokens: 512 });

assert.equal(PROMPT_SCHEMA_VERSION, "1.0");
assert.equal(JSON.stringify(request), JSON.stringify(repeated), "the same input must produce identical output");
assert.equal(request.promptSchemaVersion, PROMPT_SCHEMA_VERSION);
assert.deepEqual(Array.from(request.messages, message => message.role), ["system", "user"]);
assert.equal(request.messages[0].content, SYSTEM_INSTRUCTIONS);
assert.match(SYSTEM_INSTRUCTIONS, /verbatim/i);
assert.match(SYSTEM_INSTRUCTIONS, /Field verification required/);
assert.match(SYSTEM_INSTRUCTIONS, /Do not invent/i);
const serialized = request.messages[1].content.slice(request.messages[1].content.indexOf("\n") + 1);
const source = JSON.parse(serialized);
assert.equal(source.issues[0].observation, observation);
assert.deepEqual(source.issues.map(issue => issue.issueId), ["issue-b", "issue-a"]);
assert.equal(source.issues[0].workOrderNumber, "WO-<42>");
assert.equal("uiState" in source, false);
assert.equal("selected" in source.issues[0], false);
assert.equal(request.metadata.walkId, "walk-edge");
assert.equal(request.metadata.walkSchemaVersion, "1.0");
assert.equal(request.metadata.promptSchemaVersion, "1.0");
assert.equal("generatedAt" in request.metadata, false, "reproducibility metadata must not contain volatile values");
assert.equal(Object.isFrozen(request), true);
assert.equal(Object.isFrozen(request.messages), true);
raw.issues[0].observation = "mutated";
assert.equal(source.issues[0].observation, observation);

assert.throws(() => buildPromptRequest(raw), /normalized|unsupported field/i, "raw app objects must be rejected");
assert.throws(() => buildPromptRequest({ ...normalized, storageKey: 4 }), /unsupported field/i);
const forbiddenPhotoWalk = normalizeWalkForAi({ id: "photo-walk", issues: [{ id: "photo-issue", observation: "Photo", photos: ["data:image/png;base64,dGVzdA=="] }] });
const forgedPhotoWalk = { ...forbiddenPhotoWalk, issues: [{ ...forbiddenPhotoWalk.issues[0], photos: [{ ...forbiddenPhotoWalk.issues[0].photos[0], temporaryPreview: true }] }] };
assert.throws(() => buildPromptRequest(forgedPhotoWalk), /unsupported field/i);
for (const options of [null, [], { model: "" }, { maxOutputTokens: 0 }, { temperature: 1 }]) {
  assert.throws(() => buildPromptRequest(normalized, options), /prompt option/i);
}

console.log("PASS: deterministic, versioned AI prompt payload, source preservation, safety rules, validation, and immutability.");
