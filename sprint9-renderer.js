(() => {
  "use strict";

  const VERSION = "v0.9.10-alpha13";
  let currentWalk = null;

  function escapeValue(value) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(value == null ? "" : value);
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function workOrderNumber(walk, index) {
    if (typeof window.getSprint8WorkOrderNumber === "function") return window.getSprint8WorkOrderNumber(walk, index);
    return `WO-${String(index + 1).padStart(3, "0")}`;
  }

  function buildStructuredPrompt(walk) {
    const settings = window.gptPlantWalkSettings || {};
    const issueRecords = (walk.issues || []).map((issue, index) => ({
      issueNumber: index + 1,
      workOrderNumber: workOrderNumber(walk, index),
      capturedTime: issue.time || "",
      originalObservation: issue.observation || "Photo-only issue",
      photoCount: Array.isArray(issue.photos) ? issue.photos.length : 0
    }));

    return `GPT PLANT WALK — MAINTENANCE ANALYSIS DATA REQUEST

Analyze the attached GPT Plant Walk source PDF, including every embedded photo. Return ONLY one valid JSON object. Do not create a PDF and do not use markdown fences.

The GPT Plant Walk app—not ChatGPT—will render the approved Work Order Standard v1.0 pages. Your job is to provide accurate maintenance planning content for the app to place into that locked template.

RULES
- Total issues: ${issueRecords.length}
- Return exactly ${issueRecords.length} issue objects in the original order.
- Preserve every exact work-order number below.
- Preserve each original observation exactly.
- Review the matching photo for each issue and keep photos associated with the correct issue.
- Do not combine, split, omit, or renumber issues.
- Use only these priority names: Immediate, Urgent, Planned, Monitor.
- Use practical maintenance language and specific corrective actions.
- Do not estimate labor time.
- Do not include work-order status or production impact.
- State field verification when evidence is incomplete.

COMPANY
Company: ${settings.companyName || "Not configured"}
Plant: ${settings.plantName || "Not configured"}
Walk Started: ${walk.startedAt || ""}
Walk Ended: ${walk.endedAt || ""}

REQUIRED JSON SHAPE
{
  "maintenanceSummary": "one concise paragraph",
  "prioritizedActions": [
    {
      "priority": "Immediate|Urgent|Planned|Monitor",
      "issueNumber": 1,
      "workOrderNumber": "exact supplied number",
      "equipmentArea": "concise equipment or area",
      "recommendedAction": "concise action"
    }
  ],
  "maintenanceRepairNotes": ["issue-specific note"],
  "reliabilityEngineeringNotes": ["supported reliability recommendation"],
  "issues": [
    {
      "issueNumber": 1,
      "workOrderNumber": "exact supplied number",
      "priority": "Immediate|Urgent|Planned|Monitor",
      "trade": "Mechanical|Electrical|Controls|Facilities|Reliability|Housekeeping|Other",
      "equipmentArea": "likely equipment or area",
      "originalObservation": "exact original observation",
      "problem": "concise problem statement",
      "likelyCause": "credible likely cause with uncertainty stated",
      "recommendedRepair": ["specific step 1", "specific step 2", "specific step 3"],
      "partsNeeded": "likely parts or Verify in field",
      "verification": ["post-repair check 1", "post-repair check 2"],
      "photoContext": "what the matching photo supports, or No photo attached"
    }
  ]
}

ISSUE RECORDS
${JSON.stringify(issueRecords, null, 2)}
`;
  }

  function findAnalysis(walk, index) {
    const packet = walk && walk.aiPacket;
    const items = packet && Array.isArray(packet.issues) ? packet.issues : [];
    const number = workOrderNumber(walk, index);
    return items.find(item => item && item.workOrderNumber === number) || items[index] || null;
  }

  function brandHtml() {
    const settings = window.gptPlantWalkSettings || {};
    const logo = settings.companyLogo ? `<img class="wo-company-logo" src="${settings.companyLogo}" alt="Company logo" />` : "";
    const company = settings.companyName || "Maintenance Department";
    const plant = settings.plantName || "";
    return `<div class="wo-brand">${logo}<div><strong>${escapeValue(company)}</strong>${plant ? `<span>${escapeValue(plant)}</span>` : ""}</div></div>`;
  }

  function photoHtml(issue) {
    if (!issue || !Array.isArray(issue.photos) || !issue.photos.length) return "";
    return `<div class="wo-inline-photo"><img src="${issue.photos[0]}" alt="Issue photo" /></div>`;
  }

  function checkboxLines(lines) {
    return (Array.isArray(lines) ? lines : []).slice(0, 5).map(line => `<div class="wo-check-line">☐ ${escapeValue(line)}</div>`).join("");
  }

  function buildLockedWorkOrder(walk, issue, index) {
    const ai = findAnalysis(walk, index) || {};
    const number = workOrderNumber(walk, index);
    const photo = photoHtml(issue);
    const observation = issue.observation || "Photo-only issue";
    const repairLines = [];
    if (ai.problem) repairLines.push(`Problem: ${ai.problem}`);
    if (ai.likelyCause) repairLines.push(`Likely cause: ${ai.likelyCause}`);
    if (Array.isArray(ai.recommendedRepair)) repairLines.push(...ai.recommendedRepair);
    if (Array.isArray(ai.verification)) repairLines.push(...ai.verification.map(item => `Verify: ${item}`));
    if (!repairLines.length) repairLines.push("Final repair plan pending ChatGPT analysis import.");

    return `<section class="work-order-page sprint9-locked-work-order ${photo ? "has-inline-photo" : ""}">
      <div class="wo-title-row">
        ${brandHtml()}
        <div class="wo-document-title"><span>MAINTENANCE WORK ORDER</span><h2>${escapeValue(number)}</h2></div>
      </div>

      <div class="wo-header-card sprint9-header-card">
        <div><span>PRIORITY</span><strong>${escapeValue(ai.priority || "Planned")}</strong></div>
        <div><span>TRADE</span><strong>${escapeValue(ai.trade || "Verify in field")}</strong></div>
        <div><span>REPORTED</span><strong>${escapeValue(issue.time || walk.startedAt || "")}</strong></div>
        <div class="wo-header-wide"><span>LIKELY EQUIPMENT / AREA</span><strong>${escapeValue(ai.equipmentArea || observation)}</strong></div>
      </div>

      <div class="wo-observation-row ${photo ? "with-photo" : ""}">
        <div class="wo-section wo-observation"><h3>Initial Observation</h3><p>${escapeValue(observation)}</p></div>
        ${photo}
      </div>

      <div class="wo-section wo-actions">
        <h3>Suggested Corrective Actions</h3>
        ${checkboxLines(repairLines)}
      </div>

      <div class="wo-section wo-notes">
        <h3>Technician — Work Performed / Findings</h3>
        <div class="wo-writing-lines"><i></i><i></i><i></i></div>
      </div>

      <div class="wo-section wo-parts">
        <h3>Parts Used</h3>
        <p class="wo-parts-hint"><strong>Likely parts:</strong> ${escapeValue(ai.partsNeeded || "Verify in field")}</p>
        <table><thead><tr><th>Part Number</th><th>Description</th><th>Qty</th></tr></thead><tbody><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></tbody></table>
      </div>

      <div class="wo-section sprint9-labor"><h3>Labor</h3><div><strong>Technician(s):</strong> ____________________ &nbsp;&nbsp; <strong>Actual Labor Time:</strong> ______ Hours</div></div>

      <div class="wo-section wo-completion">
        <h3>Completion / Sign-Off</h3>
        <div class="wo-signoff-grid sprint9-signoff-grid">
          <div><span>COMPLETED BY</span><strong></strong></div>
          <div><span>DATE</span><strong></strong></div>
          <div><span>TIME</span><strong></strong></div>
        </div>
      </div>

      <p class="wo-footer">Generated by GPT Plant Walk • Work Order Standard v1.0 • ${escapeValue(number)}</p>
    </section>`;
  }

  function applyPacketToReport(walk) {
    const packet = walk.aiPacket || {};
    const host = document.createElement("div");
    const baseBuilder = window.__sprint9RendererBaseBuilder;
    host.innerHTML = typeof baseBuilder === "function" ? baseBuilder(walk) : "";

    host.querySelectorAll(".work-order-page, .work-order-print-terminator").forEach(node => node.remove());

    const summaryHeading = Array.from(host.querySelectorAll(".report-section h2")).find(h => h.textContent.trim().startsWith("1."));
    if (summaryHeading && summaryHeading.nextElementSibling && packet.maintenanceSummary) summaryHeading.nextElementSibling.textContent = packet.maintenanceSummary;

    const actionTable = host.querySelector(".report-section table tbody");
    if (actionTable && Array.isArray(packet.prioritizedActions)) {
      actionTable.innerHTML = packet.prioritizedActions.map(item => `<tr><td>${escapeValue(item.priority)}</td><td>Issue ${escapeValue(item.issueNumber)}</td><td>${escapeValue(item.workOrderNumber)}</td><td>${escapeValue(item.recommendedAction)}</td></tr>`).join("");
    }

    (walk.issues || []).forEach((issue, index) => host.insertAdjacentHTML("beforeend", buildLockedWorkOrder(walk, issue, index)));
    host.insertAdjacentHTML("beforeend", '<div class="work-order-print-terminator" aria-hidden="true">.</div>');
    return host.innerHTML;
  }

  function validatePacket(packet, walk) {
    if (!packet || !Array.isArray(packet.issues)) throw new Error("JSON must contain an issues array.");
    if (packet.issues.length !== walk.issues.length) throw new Error(`Expected ${walk.issues.length} issues but received ${packet.issues.length}.`);
    packet.issues.forEach((item, index) => {
      const expected = workOrderNumber(walk, index);
      if (!item || item.workOrderNumber !== expected) throw new Error(`Issue ${index + 1} must use work order ${expected}.`);
    });
  }

  function installImportPanel() {
    const actions = document.querySelector(".report-actions");
    if (!actions || document.getElementById("aiAnalysisImportPanel")) return;
    const panel = document.createElement("div");
    panel.id = "aiAnalysisImportPanel";
    panel.className = "ai-analysis-import-panel";
    panel.innerHTML = `<h3>Import ChatGPT Analysis</h3><p class="muted">Paste the JSON returned by ChatGPT. The app will build the final packet using the locked Work Order Standard v1.0 design.</p><textarea id="aiAnalysisJson" placeholder="Paste ChatGPT JSON here"></textarea><button id="applyAiAnalysisBtn" type="button">Build Final Maintenance Packet</button>`;
    actions.appendChild(panel);
    panel.querySelector("#applyAiAnalysisBtn").addEventListener("click", () => {
      try {
        if (!currentWalk) throw new Error("Generate a plant walk report first.");
        const raw = panel.querySelector("#aiAnalysisJson").value.trim();
        const packet = JSON.parse(raw);
        validatePacket(packet, currentWalk);
        currentWalk.aiPacket = packet;
        currentWalk.version = VERSION;
        if (typeof persistWalks === "function") Promise.resolve(persistWalks()).catch(console.error);
        const report = document.getElementById("professionalReport");
        if (report) report.innerHTML = applyPacketToReport(currentWalk);
        alert("AI analysis imported. The final packet now uses Work Order Standard v1.0.");
      } catch (error) {
        alert(`Could not import analysis: ${error.message || error}`);
      }
    });
  }

  function install() {
    if (typeof window.buildProfessionalReportHtml !== "function") return false;
    if (window.buildProfessionalReportHtml.__sprint9RendererInstalled) return true;
    window.__sprint9RendererBaseBuilder = window.buildProfessionalReportHtml;
    function builder(walk) {
      currentWalk = walk;
      const html = walk.aiPacket ? applyPacketToReport(walk) : window.__sprint9RendererBaseBuilder(walk);
      window.setTimeout(installImportPanel, 0);
      return html;
    }
    builder.__sprint9RendererInstalled = true;
    window.buildProfessionalReportHtml = builder;
    window.buildChatGptReport = buildStructuredPrompt;
    return true;
  }

  function setVersion() {
    const footer = document.getElementById("appVersionText");
    if (footer) footer.textContent = `GPT Plant Walk ${VERSION} — Sprint 9 Locked Renderer`;
    document.querySelectorAll(".about-row").forEach(row => {
      const label = row.querySelector("span");
      const value = row.querySelector("strong");
      if (label && value && label.textContent.trim() === "App Version") value.textContent = VERSION;
    });
    const button = document.getElementById("copyReportBtn");
    if (button) button.textContent = "Copy AI Analysis Request";
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    setVersion();
    install();
    installImportPanel();
    if (attempts >= 100) window.clearInterval(timer);
  }, 100);
  setVersion();
  window.addEventListener("pageshow", setVersion);
})();