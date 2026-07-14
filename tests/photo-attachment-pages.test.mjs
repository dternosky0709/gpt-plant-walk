import assert from "node:assert/strict";
import { renderMaintenancePacketHtml } from "../api/maintenance-packet-template.js";

const html = renderMaintenancePacketHtml({
  report: { walkId: "photo-test" },
  issues: [{
    workOrderNumber: "WO-001",
    originalObservation: "Observed condition with two matching photos.",
    photos: [
      { url: "data:image/png;base64,cGhvdG8x" },
      { url: "data:image/png;base64,cGhvdG8y" }
    ]
  }]
});

assert.equal((html.match(/class="packet-page work-order-page"/g) || []).length, 1, "one issue must create one work-order page");
assert(!html.includes("WORK ORDER PHOTO ATTACHMENT"), "separate photo attachment pages are prohibited");
assert(html.includes("Initial Observation and Issue Photo"), "observation and primary photo must share the work-order page");
assert(html.includes("1 additional photo attached to this issue"), "additional photos must be referenced");
console.log("PASS: photos stay with the matching one-page work order and do not create attachment pages.");
