(() => {
  "use strict";

  const VERSION = "v0.9.8-alpha11";
  const FOOTER_TEXT = `GPT Plant Walk ${VERSION} — Sprint 9 Phase 2`;

  function getSettings() {
    return window.gptPlantWalkSettings || {};
  }

  function getWalkDate(walk) {
    const parsed = new Date(walk && walk.startedAt);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function getWorkOrderNumber(walk, issueIndex) {
    if (typeof window.getSprint8WorkOrderNumber === "function") {
      return window.getSprint8WorkOrderNumber(walk, issueIndex);
    }

    const settings = getSettings();
    const sequence = (Number(settings.sequenceStart) || 1) + issueIndex;
    if (typeof window.generateWorkOrderNumber === "function") {
      return window.generateWorkOrderNumber(sequence, getWalkDate(walk), settings);
    }

    const digits = Number(settings.sequenceDigits) || 3;
    return `WO-${String(sequence).padStart(digits, "0")}`;
  }

  function photoDescription(issue) {
    const count = Array.isArray(issue && issue.photos) ? issue.photos.length : 0;
    if (!count) return "No photos attached.";
    return `${count} photo${count === 1 ? "" : "s"} attached to this issue in the source PDF. Review only those photo(s) when analyzing this issue.`;
  }

  function buildIssueSourceBlock(walk, issue, index) {
    const number = getWorkOrderNumber(walk, index);
    return `ISSUE ${index + 1}
Exact Work Order Number: ${number}
Captured Time: ${issue.time || "Not recorded"}
Original Observation (preserve verbatim):
${issue.observation || "Photo-only issue"}
Photo Association: ${photoDescription(issue)}
Issue Order Rule: This remains Issue ${index + 1}; do not merge, omit, split, or renumber it.`;
  }

  function buildSprint9Prompt(walk) {
    const settings = getSettings();
    const companyName = settings.companyName || "Not configured";
    const plantName = settings.plantName || "Not configured";
    const issueBlocks = (Array.isArray(walk.issues) ? walk.issues : [])
      .map((issue, index) => buildIssueSourceBlock(walk, issue, index))
      .join("\n\n----------------------------------------\n\n");

    return `GPT PLANT WALK — FINAL MAINTENANCE PACKET SPECIFICATION

DELIVERABLE
Analyze the attached GPT Plant Walk source PDF and the issue records below. Produce one finished, professional, downloadable PDF maintenance packet. Do not merely describe what the packet should contain. Create the completed packet.

ROLE
Act as a senior Maintenance Manager, Mechanical Maintenance Planner, Reliability Engineer, Controls Engineer, and Engineering Director reviewing a real industrial plant walk.

SOURCE AUTHORITY AND TRACEABILITY
- The attached PDF is the source of truth for observations, timestamps, issue photos, company branding, and work-order numbers.
- Review every page and every embedded photo before assigning priority, trade, equipment, likely cause, repair direction, parts, or verification steps.
- Use the written observation first and the matching issue photo(s) as supporting evidence.
- Preserve each original observation exactly in the traceability section.
- Never invent a fact that is not supported by the note or photo. State what must be verified in the field when uncertain.
- Any preliminary priority, trade, equipment, or repair wording printed by the app is reference material only. Perform your own maintenance analysis.

NON-NEGOTIABLE ISSUE CONTROL RULES
- Total issues: ${walk.issues.length}
- Create exactly ${walk.issues.length} work order page${walk.issues.length === 1 ? "" : "s"}: one for every issue.
- Preserve issue order exactly.
- Preserve every exact work-order number supplied below.
- Do not combine issues, split issues, renumber issues, or omit an issue.
- Keep each photo associated only with the issue where it appears in the source PDF.
- Include the matching issue photo on its work-order page when a photo exists.

COMPANY / WALK INFORMATION
Company: ${companyName}
Plant: ${plantName}
Walk Started: ${walk.startedAt}
Walk Ended: ${walk.endedAt || "Not completed"}
App Version: ${VERSION}

PRIORITY STANDARD
Use priority names only. Never use P1, P2, P3, or P4.
- Immediate: production down, high risk, or equipment likely to fail very soon.
- Urgent: should be handled soon to prevent downtime or equipment damage.
- Planned: needs a work order but can be scheduled through normal maintenance planning.
- Monitor: track during future walks or PMs; no immediate work unless the condition worsens.

MAINTENANCE WRITING STANDARD
- Write like an experienced maintenance planner, not a generic AI assistant.
- Be concise, practical, and specific.
- Give mechanics useful direction beyond “inspect and correct.”
- Use plain headings such as Problem, Likely Cause, Recommended Repair, Parts Needed, and Verification.
- Avoid generic executive-summary language and boilerplate safety sections.
- Mention safety controls only when they are relevant to the actual task.
- Keep assumptions and field-verification needs explicit.

FINAL PDF PACKET ORDER
Use exactly this order. Do not add a cover page.

1. Maintenance Summary
One short paragraph identifying the main maintenance concerns and overall urgency.

2. Prioritized Action List
Create a table with these columns:
Priority | Issue | Likely Equipment / Area | Work Order # | Recommended Action

3. Maintenance / Repair Notes
Provide concise, issue-specific repair insight, inspection points, adjustments, replacement considerations, and post-repair checks. Organize by work-order number.

4. Reliability / Engineering Notes
Include only useful PM changes, spare-parts recommendations, repeat-failure concerns, design improvements, access improvements, guarding, cable/sensor protection, or follow-up actions supported by the issues.

5. Issue Details With Original Notes
For every issue, list:
- Issue number
- Exact work-order number
- Captured time
- Original observation exactly as written
- Photo count
- Concise visual context from the matching photo(s), or “No photo attached”

6. Work Order Standard v1.0 Pages
After the report sections, create exactly one separate work-order page for each issue in the original order.

WORK ORDER STANDARD v1.0 — REQUIRED PAGE LAYOUT
Each work order should remain on one page whenever practical and contain:

Header
- Company logo when available in the attached PDF
- Company name and plant name
- Title: MAINTENANCE WORK ORDER
- Exact work-order number

Top Information Table
- Priority
- Trade: Mechanical, Electrical, Controls, Facilities, Reliability, Housekeeping, or Other
- Reported time/date
- Area / Equipment
- Photo count

Initial Observation
- Reproduce the original observation exactly.
- Include the matching issue photo beside or immediately below this section when available. Do not crop away relevant visual information.

Problem
- Concise maintenance problem statement based on the note and photo.

Likely Cause
- List the most credible likely cause or failure mode.
- Clearly label uncertainty and field verification requirements.

Recommended Repair
- Provide a short, practical checklist of specific repair actions.
- Include inspection, adjustment, replacement, testing, and return-to-service checks appropriate to the issue.

Parts Needed
- Suggest likely parts or materials only when reasonably supported.
- Use “Verify in field” when exact parts cannot be determined.

Technician — Work Performed / Findings
- Leave a large blank writing area. Do not prefill this section.

Parts Used
- Leave a blank table with columns: Part Number | Description | Qty.

Labor
- Technician(s): blank line(s)
- Actual Labor Time: blank field followed by “Hours”
- Do not estimate labor time.

Completion / Sign-Off
- Completed By: blank
- Date: blank
- Time: blank
- Do not add a work-order status field.
- Do not add a production-impact section.

FINAL QUALITY CHECK BEFORE DELIVERING
- Confirm the number of work-order pages equals ${walk.issues.length}.
- Confirm the final issue has a work-order page.
- Confirm all exact work-order numbers match the source records below.
- Confirm every photo remains attached to the correct issue.
- Confirm technician notes, parts used, actual labor time, and completion fields are blank.
- Confirm there is no cover page, no test page, and no blank trailing page.
- Deliver the result as a downloadable PDF.

ISSUE SOURCE RECORDS

${issueBlocks}
`;
  }

  function updateSourcePacketLanguage(html) {
    const host = document.createElement("div");
    host.innerHTML = html;

    const summary = host.querySelector(".report-section:nth-of-type(1) p");
    if (summary) {
      summary.textContent = "This source packet contains the original plant-walk observations, timestamps, photos, and exact work-order numbers for ChatGPT to analyze and convert into the final maintenance packet.";
    }

    host.querySelectorAll(".compact-report-issue").forEach((box, index) => {
      const issue = box.querySelectorAll("p");
      if (issue[1]) {
        issue[1].innerHTML = `<strong>AI Handoff:</strong> ChatGPT must independently determine final priority, trade, equipment, likely cause, repair plan, parts, and verification for Issue ${index + 1}.`;
      }
    });

    const section4 = Array.from(host.querySelectorAll(".report-section h2")).find(h => h.textContent.trim().startsWith("4."));
    if (section4 && section4.nextElementSibling) {
      section4.nextElementSibling.textContent = "Final issue-specific maintenance and repair notes will be generated by ChatGPT after reviewing the original observations and matching photos.";
    }

    const section5 = Array.from(host.querySelectorAll(".report-section h2")).find(h => h.textContent.trim().startsWith("5."));
    if (section5 && section5.nextElementSibling) {
      section5.nextElementSibling.textContent = "Final reliability and engineering recommendations will be generated by ChatGPT from the supported evidence in this source packet.";
    }

    host.querySelectorAll(".report-meta-grid p, .report-header p").forEach(item => {
      if (item.textContent.trim().startsWith("App Version:")) {
        item.innerHTML = `<strong>App Version:</strong> ${VERSION}`;
      }
    });

    return host.innerHTML;
  }

  function installSprint9() {
    if (typeof window.buildProfessionalReportHtml !== "function") return false;
    if (window.buildProfessionalReportHtml.__sprint9Wrapped) return true;

    const currentReportBuilder = window.buildProfessionalReportHtml;
    function sprint9ReportBuilder(walk) {
      return updateSourcePacketLanguage(currentReportBuilder(walk));
    }
    sprint9ReportBuilder.__sprint9Wrapped = true;
    window.buildProfessionalReportHtml = sprint9ReportBuilder;
    window.buildChatGptReport = buildSprint9Prompt;
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

    const copyButton = document.getElementById("copyReportBtn");
    if (copyButton) copyButton.textContent = "Copy Final Packet Prompt";

    try {
      if (typeof activeWalk !== "undefined" && activeWalk) activeWalk.version = VERSION;
    } catch (error) {
      console.error("Could not apply Sprint 9 version.", error);
    }
  }

  setVersion();
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    setVersion();
    if (installSprint9() || attempts >= 80) window.clearInterval(timer);
  }, 100);

  window.addEventListener("pageshow", setVersion);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) setVersion();
  });
})();