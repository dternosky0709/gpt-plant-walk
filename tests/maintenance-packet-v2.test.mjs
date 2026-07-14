import assert from "node:assert/strict";
import { renderMaintenancePacketHtml } from "../api/maintenance-packet-template.js";

const observation = "Fan vibration reported at Kiln 3; confirm asset and condition in the field.";
const packet = {
  company: { plant: "Test Plant" },
  report: { walkId: "walk-test", startedAt: "2026-07-14 07:00", completedAt: "2026-07-14 07:30", generatedAt: "2026-07-14 08:00", inspector: "Test User" },
  issues: [{ workOrderNumber: "WO-20260714-001", priority: "Urgent", equipment: "Kiln 3 Waste Gas Fan", area: "Kiln 3", trade: "Mechanical", timeObserved: "07:04", originalObservation: observation, conditionSummary: "Excessive vibration was reported during operation.", likelyFailureMode: "Possible fan imbalance.", operationalImpact: "Continued operation may affect availability.", safetyConsiderations: "Apply site lockout/tagout requirements.", aiConfidence: "Medium", correctiveWork: ["Inspect the fan assembly for buildup, damage, and looseness.", "Function-test after approved corrective work."], recommendedAction: "Inspect the fan assembly.", photos: [{ url: "data:image/png;base64,dGVzdA==" }] }]
};

const html = renderMaintenancePacketHtml(packet);
assert.equal((html.match(/class="packet-page/g) || []).length, 2, "one cover plus one work-order page is required");
assert.equal((html.match(/class="packet-page work-order-page"/g) || []).length, 1, "one issue must create exactly one work-order page");
assert(html.includes(observation), "original observation must be preserved verbatim");
assert(html.includes("Initial Observation and Issue Photo"), "observation and photo section is required");
assert(html.includes("Technician Notes / Work Performed"), "technician notes are required");
assert(html.includes("Actual Repair Time"), "actual repair time is required");
assert(html.includes("Date Completed"), "completion date is required");
assert(html.includes("Parts Used"), "manual parts-used table is required");
assert(!/Reliability Recommendations|Reliability \/ Engineering Notes/i.test(html), "reliability recommendations must not appear in the packet");
assert(!/Meridian Manufacturing/i.test(html), "fake company names must not appear");
assert(!/estimated duration|planning level/i.test(html), "unapproved planning fields must not appear");
console.log("PASS: Maintenance Packet v2.0 structure and governed content rules.");
