import assert from "node:assert/strict";
import { renderMaintenancePacketHtml } from "../api/maintenance-packet-template.js";

const packet = { report: { walkId: "walk", startedAt: "2026-07-14", completedAt: "2026-07-14" }, company: {}, issues: [1, 2].map(sequence => ({ sequence, workOrderNumber: `WO-${sequence}`, originalObservation: `Issue ${sequence}`, photos: [] })) };
const html = renderMaintenancePacketHtml(packet);
assert.match(html, /@page\s*\{[^}]*size:\s*Letter/i);
assert.match(html, /\.packet-page\s*\{[^}]*page-break-after:\s*always/i);
assert.match(html, /\.packet-page:last-child\s*\{[^}]*page-break-after:\s*auto/i);
assert.equal((html.match(/class="packet-page work-order-page"/g) || []).length, 2);
console.log("PASS: Maintenance Packet print pagination uses one page per issue without a trailing blank page.");
