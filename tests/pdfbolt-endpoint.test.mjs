import assert from "node:assert/strict";
import handler from "../api/generate-maintenance-packet.js";

let requestBody;
globalThis.fetch = async (_url, options) => {
  requestBody = JSON.parse(options.body);
  return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), { status: 200, headers: { "content-type": "application/pdf" } });
};

const headers = {};
let statusCode;
let output;
const response = {
  setHeader(name, value) { headers[name] = value; },
  status(value) { statusCode = value; return this; },
  json(value) { output = value; },
  end(value) { output = value; }
};

delete process.env.PDFBOLT_API_KEY;
await handler({ method: "POST", body: { report: { walkId: "missing-key" }, issues: [{}] } }, response);
assert.equal(statusCode, 500);
assert.equal(output.error, "PDFBolt is not configured. Add PDFBOLT_API_KEY to the deployment environment.");

process.env.PDFBOLT_API_KEY = "test-key";
await handler({ method: "POST", body: { report: { walkId: "endpoint-test" }, issues: [{ originalObservation: "Verbatim observation" }] } }, response);
assert.equal(statusCode, 200);
assert.equal(headers["Content-Type"], "application/pdf");
assert(requestBody.html, "PDFBolt request must contain Base64 HTML");
assert(!requestBody.templateId, "production rendering must not depend on an outdated PDFBolt dashboard template");
const html = Buffer.from(requestBody.html, "base64").toString("utf8");
assert(html.includes("Maintenance Packet"));
assert(html.includes("Verbatim observation"));
assert(html.includes("Field verification required"), "missing analysis must use the governed fallback");
assert(!html.includes("Reliability Recommendations"));
assert(output instanceof Buffer);
console.log("PASS: endpoint sends governed HTML directly to PDFBolt and returns the PDF response.");
