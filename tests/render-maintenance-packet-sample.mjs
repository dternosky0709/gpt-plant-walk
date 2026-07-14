import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderMaintenancePacketHtml } from "../api/maintenance-packet-template.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "tmp", "pdfs");
fs.mkdirSync(outputDir, { recursive: true });

const pixel = "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#dcefe3"/><circle cx="400" cy="250" r="145" fill="#2f7d57"/><text x="400" y="265" text-anchor="middle" font-family="Arial" font-size="36" fill="white">SAMPLE ISSUE PHOTO</text></svg>').toString("base64");
const priorities = ["Immediate", "Urgent", "Planned", "Monitor"];
const issues = priorities.map((priority, index) => ({
  workOrderNumber: `WO-20260714-00${index + 1}`,
  priority,
  equipment: ["Kiln 3 Waste Gas Fan", "Line 2 Conveyor", "Packaging Dust Collector", "Warehouse Door"][index],
  area: ["Kiln 3", "Line 2", "Packaging", "Warehouse"][index],
  trade: index === 3 ? "Facilities" : "Mechanical",
  timeObserved: `07:${String(index * 8 + 4).padStart(2, "0")}`,
  originalObservation: ["Waste gas fan has excessive vibration during operation.", "Conveyor belt edge is visibly worn near the discharge pulley.", "Dust collector access door seal is leaking dust.", "Warehouse door roller is noisy during travel."][index],
  conditionSummary: "The reported condition requires confirmation and maintenance review before corrective work begins.",
  likelyFailureMode: "Supported preliminary failure mode for sample rendering.",
  operationalImpact: "Continued operation may reduce equipment availability.",
  safetyConsiderations: "Apply site-specific isolation and access procedures.",
  aiConfidence: "Medium",
  correctiveWork: ["Verify the reported condition and affected component.", "Complete the approved issue-specific corrective work.", "Function-test the equipment after the repair."],
  recommendedAction: "Verify condition and complete approved corrective work.",
  photos: index < 3 ? [{ url: pixel }] : []
}));

const html = renderMaintenancePacketHtml({
  company: { plant: "Sample Manufacturing Plant" },
  report: {
    walkId: "sample-walk-20260714",
    inspector: "Sample Inspector",
    startedAt: "July 14, 2026 - 7:00 AM",
    completedAt: "July 14, 2026 - 7:45 AM",
    generatedAt: "July 14, 2026 - 8:00 AM",
    managementAttention: ["One Immediate issue requires prompt field verification.", "One Urgent issue should be reviewed during the next maintenance planning meeting."],
    safetyOperationalRisks: ["Confirm all isolation and access requirements before work begins."]
  },
  issues
});

const outputPath = path.join(outputDir, "maintenance-packet-v2-sample.html");
fs.writeFileSync(outputPath, html, "utf8");
const workOrderPreview = html
  .replace("</style>", ".cover-page{display:none}.work-order-page~.work-order-page{display:none}</style>")
  .replace("class=\"packet-page work-order-page\"", "class=\"packet-page work-order-page first-work-order\"");
fs.writeFileSync(path.join(outputDir, "work-order-v2-preview.html"), workOrderPreview, "utf8");
console.log(outputPath);
