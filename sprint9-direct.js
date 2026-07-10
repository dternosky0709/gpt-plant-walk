(() => {
  "use strict";

  const VERSION = "v0.9.11-alpha14";
  const FOOTER_TEXT = `GPT Plant Walk ${VERSION} — Sprint 9 Direct Packet`;

  function getSettings() {
    return window.gptPlantWalkSettings || {};
  }

  function workOrderNumber(walk, index) {
    if (typeof window.getSprint8WorkOrderNumber === "function") {
      return window.getSprint8WorkOrderNumber(walk, index);
    }
    return `WO-${String(index + 1).padStart(3, "0")}`;
  }

  function issueBlock(walk, issue, index) {
    const count = Array.isArray(issue.photos) ? issue.photos.length : 0;
    return `ISSUE ${index + 1}
Exact Work Order Number: ${workOrderNumber(walk, index)}
Captured Time: ${issue.time || "Not recorded"}
Original Observation — preserve verbatim:
${issue.observation || "Photo-only issue"}
Photo Count: ${count}
Photo Rule: ${count ? `Use the ${count} photo${count === 1 ? "" : "s"} printed with Issue ${index + 1} in the source PDF and place the matching photo on this work-order page.` : "No photo is attached; do not add one."}`;
  }

  function buildDirectPrompt(walk) {
    const settings = getSettings();
    const issues = Array.isArray(walk.issues) ? walk.issues : [];
    const records = issues.map((issue, index) => issueBlock(walk, issue, index)).join("\n\n----------------------------------------\n\n");

    return `GPT PLANT WALK — LOCKED FINAL MAINTENANCE PACKET SPECIFICATION

DELIVERABLE
Review the attached GPT Plant Walk source PDF in full, including every page and embedded image. Create and return one finished, professional, downloadable PDF maintenance packet. Do not provide a text-only report, outline, mockup, JSON, or description. The downloadable PDF is the required deliverable.

SOURCE AUTHORITY
- The attached source PDF is authoritative for original observations, timestamps, issue order, work-order numbers, branding, and photos.
- Review the actual source PDF pages visually.
- The source PDF already contains examples of the approved Work Order Standard v1.0 pages. Use those printed work-order pages as the visual template.
- Preserve original observations verbatim in traceability and work-order Initial Observation sections.
- Do not invent facts. Clearly state field verification when evidence is incomplete.

ISSUE CONTROL — NON-NEGOTIABLE
- Total issues: ${issues.length}
- Create exactly ${issues.length} separate work-order pages.
- One issue equals one work-order page.
- Preserve issue order and exact work-order numbers.
- Do not combine, split, omit, or renumber issues.
- The final issue must have a work-order page.

PHOTO CONTROL — NON-NEGOTIABLE
- Review every embedded photo in the source PDF.
- Keep every photo associated with the issue where it appears.
- When an issue has a photo, place the matching photo visibly on that issue's work-order page beside or directly below Initial Observation.
- Do not substitute, crop away relevant content, or move a photo to another issue.
- When an issue has no photo, do not create one.

APPROVED VISUAL STANDARD — WORK ORDER STANDARD v1.0
The work-order pages must closely reproduce the approved pages already printed near the end of the source PDF. Do not redesign them.
Required visual traits:
- White one-page form with dark green headings and accent rule.
- Company logo/name and plant name at upper left when present.
- MAINTENANCE WORK ORDER and exact work-order number at upper right.
- Rounded, light-gray bordered section boxes with consistent left/right margins.
- Compact top information table.
- Initial Observation with matching photo in a compact bordered photo box when available.
- Suggested Corrective Actions shown as practical checkbox lines.
- Large blank Technician — Work Performed / Findings writing area.
- Parts Used section with blank table: Part Number | Description | Qty.
- Labor section with blank Technician(s) and Actual Labor Time ____ Hours.
- Completion / Sign-Off with blank Completed By, Date, and Time.
- Small Work Order Standard v1.0 footer.
- Keep each work order on one page.
- Do not use plain black grid tables as the page design.
- Do not add a work-order status field.
- Do not add production impact.

MAINTENANCE ANALYSIS STANDARD
For every issue determine:
- Priority using only Immediate, Urgent, Planned, or Monitor.
- Trade using Mechanical, Electrical, Controls, Facilities, Reliability, Housekeeping, or Other.
- Likely equipment / area.
- Concise problem statement.
- Credible likely cause with uncertainty stated.
- Specific corrective actions useful to a mechanic; never use generic wording such as “repair, inspect and verify.”
- Likely parts or materials, or “Verify in field” when unsupported.
- Post-repair verification steps.
- Do not estimate labor time.

FINAL PACKET ORDER
1. Maintenance Summary — one short paragraph.
2. Prioritized Action List — Priority | Issue | Likely Equipment / Area | Work Order # | Recommended Action.
3. Maintenance / Repair Notes — concise and organized by work-order number.
4. Reliability / Engineering Notes — only useful, evidence-supported recommendations.
5. Issue Details With Original Notes — exact observations, times, photo counts, and concise visual context.
6. Exactly ${issues.length} Work Order Standard v1.0 pages in original issue order.

COMPANY / WALK
Company: ${settings.companyName || "Not configured"}
Plant: ${settings.plantName || "Not configured"}
Walk Started: ${walk.startedAt || ""}
Walk Ended: ${walk.endedAt || "Not completed"}
App Version: ${VERSION}

ISSUE SOURCE RECORDS

${records}

FINAL QUALITY CHECK BEFORE DELIVERY
- Confirm the packet is a downloadable PDF.
- Confirm there is no cover page.
- Confirm there are exactly ${issues.length} work-order pages.
- Confirm the final issue has a work-order page.
- Confirm every exact work-order number is preserved.
- Confirm each issue photo appears on the correct work-order page.
- Confirm the work-order pages visually follow the approved source-PDF template rather than a generic table form.
- Confirm mechanic-completion fields are blank.
- Confirm there is no JSON, test page, or blank trailing page.`;
  }

  function removeLegacyImporter() {
    const panel = document.getElementById("aiAnalysisImportPanel");
    if (panel) panel.remove();
  }

  function install() {
    window.buildChatGptReport = buildDirectPrompt;
    removeLegacyImporter();
    return true;
  }

  function setVersion() {
    const footer = document.getElementById("appVersionText");
    if (footer) footer.textContent = FOOTER_TEXT;

    document.querySelectorAll(".about-row").forEach(row => {
      const label = row.querySelector("span");
      const value = row.querySelector("strong");
      if (label && value && label.textContent.trim() === "App Version") value.textContent = VERSION;
    });

    const button = document.getElementById("copyReportBtn");
    if (button) button.textContent = "Copy Final Packet Prompt";

    const workflow = document.querySelector(".report-actions .muted");
    if (workflow) workflow.innerHTML = "<strong>Final packet workflow:</strong> 1) Save the source PDF, 2) copy the final packet prompt, 3) paste both into ChatGPT, 4) download the finished maintenance packet PDF.";

    try {
      if (typeof activeWalk !== "undefined" && activeWalk) activeWalk.version = VERSION;
    } catch (error) {
      console.error("Could not apply Sprint 9 direct packet version.", error);
    }
  }

  install();
  setVersion();

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    install();
    setVersion();
    if (attempts >= 80) window.clearInterval(timer);
  }, 100);

  window.addEventListener("pageshow", () => {
    install();
    setVersion();
  });
})();