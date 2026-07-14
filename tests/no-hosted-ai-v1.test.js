const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const browserSource = fs.readFileSync(path.join(root, "pdfbolt.js"), "utf8");
const endpointSource = fs.readFileSync(path.join(root, "api", "generate-maintenance-packet.js"), "utf8");
const templateSource = fs.readFileSync(path.join(root, "api", "maintenance-packet-template.js"), "utf8");
const combined = `${browserSource}\n${endpointSource}\n${templateSource}`;

if (/api\.openai\.com|OPENAI_API_KEY|hosted AI analysis/i.test(combined)) {
  throw new Error("v1.0 maintenance-packet generation must not depend on a hosted AI-analysis service");
}
if (!browserSource.includes('"Field verification required"')) {
  throw new Error("browser packet builder must preserve the field-verification fallback");
}
if (!endpointSource.includes("renderMaintenancePacketHtml")) {
  throw new Error("PDFBolt endpoint must render the version-controlled v2.0 HTML");
}
if (/reliabilitySummary|Reliability Recommendations|Reliability \/ Engineering Notes/i.test(combined)) {
  throw new Error("reliability recommendations must not appear in the v1.0 packet path");
}

console.log("PASS: v1.0 packet generation has no hosted AI dependency and retains field-verification fallbacks.");
