(() => {
  const FINAL_VERSION = "v0.8.3";

  function settings() {
    return window.gptPlantWalkSettings || {
      companyName: "",
      plantName: "",
      companyLogo: "",
      sequenceStart: 1,
      sequenceDigits: 3,
      workOrderFormat: "WO-{DATE}-{SEQ}"
    };
  }

  function html(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function workOrderNumber(index, walk) {
    const current = settings();
    const sequence = Math.max(1, Number(current.sequenceStart) || 1) + index;
    const date = walk && walk.startedAt ? new Date(walk.startedAt) : new Date();

    if (typeof window.generateWorkOrderNumber === "function") {
      return window.generateWorkOrderNumber(sequence, Number.isNaN(date.getTime()) ? new Date() : date, current);
    }

    return `WO-${String(sequence).padStart(Number(current.sequenceDigits) || 3, "0")}`;
  }

  function brandingHtml() {
    const current = settings();
    const logo = current.companyLogo
      ? `<img class="report-company-logo" src="${current.companyLogo}" alt="Company logo" />`
      : "";
    const company = current.companyName ? `<div class="report-company-name">${html(current.companyName)}</div>` : "";
    const plant = current.plantName ? `<div class="report-plant-name">${html(current.plantName)}</div>` : "";

    return `<div class="report-branding">${logo}<div class="report-branding-text">${company}${plant}</div></div>`;
  }

  window.buildChatGptReport = function buildChatGptReport(walk) {
    const current = settings();
    let report = `GPT PLANT WALK AI MAINTENANCE REPORT REQUEST

ROLE
You are acting as a senior Maintenance Manager, Mechanical Maintenance Planner, Reliability Engineer, Controls Engineer, and Engineering Director reviewing a real plant walk.

PRIMARY OBJECTIVE
Create a concise, practical maintenance report that helps the maintenance team decide what to fix, how serious it is, what work orders to create, and what reliability improvements should be considered.

FIELD-WORKFLOW CONTEXT
The plant walk was captured quickly using short voice-dictated observations and photos. Do not require the field user to classify issues during the walk. Infer equipment, area, trade, priority, likely repair approach, and work order details from the observation text and photos. If uncertain, say what should be verified in the field.

PRIORITY NAMING STANDARD
Use priority names only. Do not label them P1, P2, P3, or P4.
- Immediate: production down, high risk, or equipment likely to fail very soon.
- Urgent: should be handled soon to prevent downtime or equipment damage.
- Planned: needs a work order but can be scheduled with normal maintenance planning.
- Monitor: track during future walks or PMs; no immediate work required unless condition worsens.

REPORT STYLE
- Be practical and maintenance-focused.
- Avoid long generic executive-summary language.
- Avoid boilerplate sections unless there is an actual issue to discuss.
- Every issue should become a suggested work order unless it is clearly informational only.
- Give mechanics useful repair direction, not just "inspect and correct."
- Keep work orders short enough to be useful in a CMMS.
- Clearly state assumptions and uncertainty.

FINAL REPORT FORMAT
Use exactly these sections:

1. Maintenance Summary
Write one short paragraph summarizing the walk, the main maintenance concerns, and the overall urgency.

2. Prioritized Action List
Create a table with columns:
Priority | Issue | Likely Equipment / Area | Suggested WO # | Recommended Action
Use only these priority names: Immediate, Urgent, Planned, Monitor.

3. Suggested Work Orders
For each issue, create a work order in this format:
[Assigned WO Number]: [Short work order title]
- Priority: Immediate, Urgent, Planned, or Monitor
- Area / Equipment:
- Trade: Mechanical, Electrical, Controls, Facilities, Reliability, Housekeeping, or Other
- Problem:
- Recommended Repair:
- Materials / Parts:
- Verification:
- Confidence: High, Medium, or Low

4. Mechanical / Maintenance Repair Notes
Provide practical repair insight for the maintenance team. Include likely checks, adjustments, replacement steps, inspection points, and what to verify after repair.

5. Reliability / Engineering Notes
List any PM changes, spare parts recommendations, repeat-failure concerns, design improvements, access improvements, guarding/cable/sensor protection, or reliability follow-up items.

6. Issue Details With Original Notes
For traceability, list each issue exactly as captured with time, observation, photo count, and any visual context inferred from photos.

COMPANY DETAILS
Company: ${current.companyName || "Not configured"}
Plant: ${current.plantName || "Not configured"}

PLANT WALK DETAILS
Walk Started: ${walk.startedAt}
Walk Ended: ${walk.endedAt || "Not completed"}
Total Issues: ${walk.issues.length}
App Version: ${FINAL_VERSION}

RAW OBSERVATIONS

`;

    walk.issues.forEach((issue, index) => {
      report += `Issue ${index + 1}
Suggested WO #: ${workOrderNumber(index, walk)}
Time: ${issue.time}
Observation:
${issue.observation || "Photo-only issue"}
Photos: ${issue.photos.length > 0 ? `Yes - ${issue.photos.length} photo(s) embedded in the PDF report` : "No"}
Instruction: Infer likely equipment, priority name, trade, repair steps, parts/materials, verification, and reliability/engineering notes from this issue.
--------------------------------

`;
    });

    return report;
  };

  window.buildProfessionalReportHtml = function buildProfessionalReportHtml(walk) {
    const totalPhotos = walk.issues.reduce((count, issue) => count + issue.photos.length, 0);
    let output = `<div class="report-header">${brandingHtml()}<div class="report-title-block"><p class="report-kicker">MAINTENANCE PLANNING</p><h1>Plant Walk Report</h1></div><div class="report-meta-grid"><p><strong>Started:</strong> ${html(walk.startedAt)}</p><p><strong>Ended:</strong> ${html(walk.endedAt || "Not completed")}</p><p><strong>Total Issues:</strong> ${walk.issues.length}</p><p><strong>Total Photos:</strong> ${totalPhotos}</p><p><strong>App Version:</strong> ${FINAL_VERSION}</p></div></div>
<section class="report-section"><h2>1. Maintenance Summary</h2><p>This walk captured ${walk.issues.length} maintenance observation${walk.issues.length === 1 ? "" : "s"}. Use the AI prompt and attached raw report to generate the final maintenance analysis, named priorities, repair guidance, and reliability recommendations.</p></section>
<section class="report-section"><h2>2. Prioritized Action List</h2><table><thead><tr><th>Priority</th><th>Issue</th><th>Suggested WO</th><th>Action</th></tr></thead><tbody>`;

    walk.issues.forEach((issue, index) => {
      output += `<tr><td>AI to assign</td><td>Issue ${index + 1}</td><td>${html(workOrderNumber(index, walk))}</td><td>${html(issue.observation || "Photo-only issue")}</td></tr>`;
    });

    output += `</tbody></table></section><section class="report-section"><h2>3. Suggested Work Orders</h2>`;

    walk.issues.forEach((issue, index) => {
      const number = workOrderNumber(index, walk);
      output += `<div class="report-issue compact-report-issue"><h3>${html(number)}: Issue ${index + 1}</h3><p><strong>Original Observation:</strong> ${html(issue.observation || "Photo-only issue")}</p><p><strong>AI Planning Needed:</strong> Determine priority name, likely equipment/area, trade, failure mode, repair steps, materials, verification, and confidence from the observation and photo(s).</p></div>`;
    });

    output += `</section><section class="report-section"><h2>4. Mechanical / Maintenance Repair Notes</h2><p>ChatGPT should provide practical repair guidance for each issue, including likely inspection points, adjustments, replacement steps, parts or materials, and post-repair checks.</p></section><section class="report-section"><h2>5. Reliability / Engineering Notes</h2><p>ChatGPT should identify PM improvements, spare parts needs, repeat-failure concerns, and engineering improvements such as access changes, guarding, cable management, sensor protection, or design changes.</p></section><section class="report-section"><h2>6. Issue Details With Original Notes</h2>`;

    walk.issues.forEach((issue, index) => {
      output += `<div class="report-issue"><h3>Issue ${index + 1} — ${html(workOrderNumber(index, walk))}</h3><p><strong>Time:</strong> ${html(issue.time)}</p><p><strong>Observation:</strong></p><p>${html(issue.observation || "Photo-only issue")}</p><p><strong>Photos:</strong> ${issue.photos.length}</p><div class="report-photo-grid">`;
      issue.photos.forEach(photo => {
        output += `<img class="report-photo" src="${photo}" alt="Issue photo" />`;
      });
      output += `</div></div>`;
    });

    output += `</section>`;
    return output;
  };

  const footer = document.getElementById("appVersionText") || document.querySelector("footer p");
  if (footer) footer.textContent = `GPT Plant Walk ${FINAL_VERSION} — Sprint 7 Final`;
})();
