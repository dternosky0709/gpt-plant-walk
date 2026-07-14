import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const index = read("../index.html");
const app = read("../app.js");
const manifest = read("../manifest.webmanifest");
const worker = read("../sw.js");

for (const text of ["Save Raw Plant Walk PDF", "Copy AI Prompt", "ChatGPT-Ready AI Prompt", "ChatGPT-ready summaries", "raw PDF and ChatGPT prompt", "buildChatGptReport"]) {
  assert.equal(index.includes(text) || app.includes(text), false, `retired workflow must be absent: ${text}`);
}
assert.match(index, /<h1>GPT Plant Walk 1\.0<\/h1>/);
assert.match(index, /id="startWalkBtn"[^>]*>Start Plant Walk</);
assert.match(index, /id="viewWalksBtn"[^>]*>Previous Walks</);
assert.match(index, /id="generatePacketBtn"[^>]*>Generate Maintenance Packet</);
assert.match(index, /id="backToStartBtn"[^>]*>Back to Start</);
assert.match(app, /const APP_VERSION = "1\.0";/);
assert.match(app, /function renderPreviousWalks\(\)/);
assert.match(app, /deleteIssue\(issue\.id, index \+ 1\)/);
assert.equal(manifest.includes("ChatGPT"), false);
assert.match(worker, /gpt-plant-walk-1\.0/);
for (const asset of ["storage.js", "app.js", "issue-deletion.js", "walk-reset.js", "settings.js", "pdfbolt.js"]) assert.ok(worker.includes(`./${asset}`), `cache ${asset}`);
for (const asset of ["report-branding.js", "release.js", "sprint8.js", "sprint9-direct.js"]) assert.equal(worker.includes(asset), false, `do not cache ${asset}`);

console.log("PASS: GPT Plant Walk 1.0 simplified release flow and offline cache.");
