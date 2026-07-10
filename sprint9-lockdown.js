(() => {
  "use strict";

  const VERSION = "v0.9.9-alpha12";
  const FOOTER_TEXT = `GPT Plant Walk ${VERSION} — Sprint 9 AI Lockdown`;

  function getSettings() {
    return window.gptPlantWalkSettings || {};
  }

  function getWalkDate(walk) {
    const parsed = new Date(walk && walk.startedAt);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function getWorkOrderNumber(walk, index) {
    if (typeof window.getSprint8WorkOrderNumber === "function") {
      return window.getSprint8WorkOrderNumber(walk, index);
    }
    const settings = getSettings();
    const sequence = (Number(settings.sequenceStart) || 1) + index;
    if (typeof window.generateWorkOrderNumber === "function") {
      return window.generateWorkOrderNumber(sequence, getWalkDate(walk), settings);
    }
    return `WO-${String(sequence).padStart(Number(settings.sequenceDigits) || 3, "0")}`;
  }

  function issueRecord(walk, issue, index) {
    const photoCount = Array.isArray(issue.photos) ? issue.photos.length : 0;
    return `ISSUE ${index + 1}\nExact Work Order Number: ${getWorkOrderNumber(walk, index)}\nCaptured Time: ${issue.time || "Not recorded"}\nOriginal Observation — reproduce verbatim:\n${issue.observation || "Photo-only issue"}\nPhoto Count: ${photoCount}\nPhoto Requirement: ${photoCount ? `Extract and embed the ${photoCount} matching issue photo${photoCount === 1 ? "" : "s"} from the attached source PDF on this work-order page.` : "Print No photo attached in the photo area."}`;
  }

  function buildLockedPrompt(walk) {
    const settings = getSettings();
    const issues = Array.isArray(walk.issues) ? walk.issues : [];
    const records = issues.map((issue, index) => issueRecord(walk, issue, index)).join("\n\n========================================\n\n");

    return `GPT PLANT WALK — LOCKED FINAL MAINTENANCE PACKET SPECIFICATION\n\nDELIVERABLE\nReview the attached GPT Plant Walk source PDF in full, including every page and embedded image. Create and return one finished, professional, downloadable PDF maintenance packet. Do not provide a text-only report, outline, mockup, or description. The downloadable PDF is the required deliverable.\n\nSOURCE AUTHORITY\n- The attached source PDF is authoritative for original observations, timestamps, issue order, work-order numbers, branding, and photos.\n- Review the actual source PDF pages visually.\n- The source PDF already contains examples of the approved Work Order Standard v1.0 pages. Use those printed work-order pages as the visual template.\n- Preserve original observations verbatim in traceability and work-order Initial Observation sections.\n- Do not invent facts. Clearly state field verification when evidence is incomplete.\n\nISSUE CONTROL — NON-NEGOTIABLE\n- Total issues: ${issues.length}\n- Create exactly ${issues.length} separate work-order pages.\n- One issue equals one work-order page.\n- Preserve issue order and exact work-order numbers.\n- Do not combine, split, omit, or renumber issues.\n- The final issue must have a work-order page.\n\nPHOTO CONTROL — NON-NEGOTIABLE\n- Locate each issue photo on the matching Issue Details page in the source PDF.\n- Extract or otherwise reuse that exact embedded image in the final PDF.\n- Place the matching photo inside the Initial Observation area of the corresponding work-order page, aligned to the right when practical.\n- Do not replace the photo with a caption, placeholder, icon, link, or written description.\n- Do not use a photo from another issue.\n- Use object-fit contain or equivalent so relevant content is not cropped.\n- When no photo exists, print No photo attached in the photo area.\n\nCOMPANY / WALK\nCompany: ${settings.companyName || "Not configured"}\nPlant: ${settings.plantName || "Not configured"}\nWalk Started: ${walk.startedAt}\nWalk Ended: ${walk.endedAt || "Not completed"}\nApp Version: ${VERSION}\n\nPRIORITIES\nUse names only: Immediate, Urgent, Planned, Monitor. Never use P1, P2, P3, or P4.\n\nFINAL PACKET ORDER\n1. Maintenance Summary\n2. Prioritized Action List\n3. Maintenance / Repair Notes\n4. Reliability / Engineering Notes\n5. Issue Details With Original Notes\n6. Work Order Standard v1.0 pages, one page per issue\nDo not add a cover page, contents page, test page, or trailing blank page.\n\nWORK ORDER VISUAL LOCK\nEach work-order page must closely reproduce the approved work-order page already shown in the attached source PDF. It must look like a clean printable maintenance form, not a narrative report. Use the following visual hierarchy and section order exactly.\n\nPAGE BLUEPRINT\n┌──────────────────────────────────────────────────────────────┐\n│ [Company logo/name]                  MAINTENANCE WORK ORDER  │\n│                                      [Exact WO Number]       │\n├────────────┬────────────┬────────────┬───────────────────────┤\n│ PRIORITY   │ TRADE      │ REPORTED   │ PHOTO COUNT           │\n├────────────┴────────────┴────────────┴───────────────────────┤\n│ LIKELY EQUIPMENT / AREA                                     │\n├───────────────────────────────────────┬──────────────────────┤\n│ INITIAL OBSERVATION                   │ MATCHING ISSUE PHOTO │\n│ Original note reproduced verbatim     │ or No photo attached │\n├───────────────────────────────────────┴──────────────────────┤\n│ PROBLEM                                                      │\n├──────────────────────────────────────────────────────────────┤\n│ LIKELY CAUSE                                                 │\n├──────────────────────────────────────────────────────────────┤\n│ RECOMMENDED REPAIR                                           │\n│ ☐ specific mechanic-ready action                             │\n│ ☐ inspection / adjustment / replacement / test              │\n├──────────────────────────────────────────────────────────────┤\n│ PARTS NEEDED                                                 │\n├──────────────────────────────────────────────────────────────┤\n│ TECHNICIAN — WORK PERFORMED / FINDINGS                       │\n│ [large blank writing area]                                   │\n├──────────────────────────────────────────────────────────────┤\n│ PARTS USED                                                   │\n│ Part Number | Description | Qty                              │\n│ [blank rows]                                                  │\n├──────────────────────────────────────────────────────────────┤\n│ LABOR                                                        │\n│ Technician(s): ______________________________                 │\n│ Actual Labor Time: __________ Hours                           │\n├──────────────────────────────────────────────────────────────┤\n│ COMPLETION / SIGN-OFF                                        │\n│ Completed By: __________  Date: ______  Time: ______          │\n└──────────────────────────────────────────────────────────────┘\n\nWORK ORDER CONTENT RULES\n- Keep each work order to one page whenever practical.\n- Use compact tables, bordered boxes, restrained spacing, and consistent margins.\n- Use the same outer left and right margins for every major box.\n- Include company branding from the source PDF when available.\n- Initial Observation must be verbatim.\n- Problem, Likely Cause, Recommended Repair, Parts Needed, and Verification must be issue-specific.\n- Recommended Repair must provide practical steps, not only inspect and correct.\n- Technician Work Performed / Findings must remain blank.\n- Parts Used table must remain blank.\n- Technician(s), Actual Labor Time, Completed By, Date, and Time must remain blank.\n- Do not estimate labor.\n- Do not add Work Order Status.\n- Do not add Production Impact.\n\nMAINTENANCE WRITING STANDARD\nWrite like an experienced maintenance planner. Be concise, specific, field-practical, and clear about uncertainty. Use written observations first and matching photos as supporting evidence.\n\nFINAL VALIDATION BEFORE EXPORT\n- Count the issue records below.\n- Count the work-order pages in the finished PDF.\n- These counts must match exactly: ${issues.length}.\n- Confirm the final issue is included.\n- Confirm every work-order number is exact.\n- Confirm every issue with a photo has the actual matching image visibly embedded on its work-order page.\n- Confirm the work-order page follows the locked blueprint rather than a newly invented design.\n- Confirm all mechanic completion fields remain blank.\n- Export and return the completed downloadable PDF.\n\nISSUE SOURCE RECORDS\n\n${records}`;
  }

  function installLockdown() {
    window.buildChatGptReport = buildLockedPrompt;
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
    if (button) button.textContent = "Copy Locked Packet Prompt";
    try {
      if (typeof activeWalk !== "undefined" && activeWalk) activeWalk.version = VERSION;
    } catch (error) {
      console.error("Could not apply Sprint 9 lockdown version.", error);
    }
  }

  installLockdown();
  setVersion();
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    installLockdown();
    setVersion();
    if (attempts >= 100) window.clearInterval(timer);
  }, 100);
  window.addEventListener("pageshow", setVersion);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) setVersion();
  });
})();