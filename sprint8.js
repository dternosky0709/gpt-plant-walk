const SPRINT8_VERSION = "v0.9.1-alpha2";

function getSprint8Settings() {
  return window.gptPlantWalkSettings || {
    companyName: "",
    plantName: "",
    companyLogo: "",
    sequenceStart: 1,
    sequenceDigits: 3,
    workOrderFormat: "WO-{DATE}-{SEQ}"
  };
}

function getSprint8WalkDate(walk) {
  const parsed = new Date(walk.startedAt);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getSprint8WorkOrderNumber(walk, issueIndex) {
  const settings = getSprint8Settings();
  const sequence = (Number(settings.sequenceStart) || 1) + issueIndex;
  if (typeof window.generateWorkOrderNumber === "function") {
    return window.generateWorkOrderNumber(sequence, getSprint8WalkDate(walk), settings);
  }
  return `WO-${String(sequence).padStart(Number(settings.sequenceDigits) || 3, "0")}`;
}

function analyzeSprint8Observation(observation) {
  const raw = String(observation || "Photo-only issue").trim();
  const text = raw.toLowerCase();

  let priority = "Planned";
  if (/seat belt|exposed wire|guard missing|fire|smoke|sparking|production down|not running|broken safety/.test(text)) priority = "Immediate";
  else if (/dropping|big cut|broken|very slow|really slow|noisy|bearing|overheat|vibrat|leak|not cooling|fault|jam/.test(text)) priority = "Urgent";
  else if (/monitor|watch|check later|minor/.test(text)) priority = "Monitor";

  let trade = "Mechanical";
  if (/robot|plc|hmi|sensor|program|recipe|position|teach|servo/.test(text)) trade = "Controls / Mechanical";
  else if (/wire|electrical|motor|drive|vfd|breaker|power|fan/.test(text)) trade = "Electrical / Mechanical";
  else if (/roof|hvac|air condition|ac unit|building|door|plumbing/.test(text)) trade = "Facilities";
  else if (/housekeeping|debris|trash|cleanup|spill/.test(text)) trade = "Housekeeping";

  const equipment = raw.length > 68 ? `${raw.slice(0, 65)}...` : raw;
  const actions = [];

  if (/bearing|noisy|vibrat/.test(text)) {
    actions.push("Inspect bearings, lubrication, mounting, alignment, and rotating components.");
    actions.push("Check for heat, looseness, rubbing, shaft play, and abnormal vibration.");
  }
  if (/belt|conveyor/.test(text)) {
    actions.push("Lock out equipment and inspect belt condition, tracking, tension, splice, pulleys, and contact points.");
    actions.push("Repair or replace damaged components and correct the source of wear before restart.");
  }
  if (/robot|dropping|grip|brick/.test(text)) {
    actions.push("Inspect end-of-arm tooling, gripping surfaces, air/vacuum supply, sensors, recipe, and timing.");
    actions.push("Run repeated test cycles with production material and verify secure pickup and placement.");
  }
  if (/slow|transfer car|pusher/.test(text)) {
    actions.push("Inspect mechanical drag, wheels/rails, bearings, brake release, drive train, and lubrication.");
    actions.push("Check motor current, drive speed reference, torque limits, faults, and loaded versus unloaded speed.");
  }
  if (/fan/.test(text)) {
    actions.push("Disconnect power and inspect blade clearance, guard contact, motor bearings, fasteners, and debris.");
    actions.push("Repair or replace the fan assembly if vibration, shaft play, or overheating is present.");
  }
  if (/seat belt/.test(text)) {
    actions.push("Remove equipment from service until the complete approved restraint assembly is replaced.");
    actions.push("Inspect buckle, retractor, webbing, anchors, seat mounting, and any restraint interlock.");
  }
  if (/roof leak|leak/.test(text)) {
    actions.push("Identify the active leak path, protect equipment or material below, and inspect the roof above the reported area.");
    actions.push("Repair the roofing defect and verify during the next rainfall or controlled water test.");
  }
  if (/not cooling|hvac|ac unit|air condition/.test(text)) {
    actions.push("Verify thermostat, power, filter, airflow, condensate, icing, and obvious electrical conditions.");
    actions.push("Schedule qualified HVAC service for refrigerant, compressor, controls, and sealed-system diagnosis.");
  }
  if (!actions.length) {
    actions.push("Verify the reported condition in the field and identify the failure point before disassembly.");
    actions.push("Repair or replace the affected component, then test under normal operating conditions.");
  }

  let parts = "As required after field inspection";
  if (/bearing/.test(text)) parts = "Bearing, seals, approved lubricant, and retaining hardware as required";
  else if (/belt/.test(text)) parts = "Replacement belt or approved repair materials, splice/lacing, and tracking hardware";
  else if (/seat belt/.test(text)) parts = "Manufacturer-approved seat-belt assembly and mounting hardware";
  else if (/fan/.test(text)) parts = "Fan blade, motor, fasteners, or complete fan assembly as required";

  return { raw, priority, trade, equipment, actions, parts };
}

function buildSprint8Brand(settings) {
  const logo = settings.companyLogo
    ? `<img class="wo-company-logo" src="${settings.companyLogo}" alt="Company logo" />`
    : "";
  const company = settings.companyName ? `<strong>${escapeHtml(settings.companyName)}</strong>` : "<strong>Maintenance Department</strong>";
  const plant = settings.plantName ? `<span>${escapeHtml(settings.plantName)}</span>` : "";
  return `<div class="wo-brand">${logo}<div>${company}${plant}</div></div>`;
}

function buildSprint8Photo(issue) {
  if (!issue.photos || issue.photos.length === 0) return "";
  return `<div class="wo-photo-wrap"><img class="wo-photo" src="${issue.photos[0]}" alt="Issue photo" /></div>`;
}

function buildSprint8WorkOrderPage(walk, issue, issueIndex) {
  const settings = getSprint8Settings();
  const number = getSprint8WorkOrderNumber(walk, issueIndex);
  const analysis = analyzeSprint8Observation(issue.observation);
  const photo = buildSprint8Photo(issue);

  return `
    <section class="work-order-page">
      <div class="wo-title-row">
        ${buildSprint8Brand(settings)}
        <div class="wo-document-title"><span>MAINTENANCE WORK ORDER</span><h2>${escapeHtml(number)}</h2></div>
      </div>

      <div class="wo-header-card">
        <div><span>PRIORITY</span><strong>${escapeHtml(analysis.priority)}</strong></div>
        <div><span>STATUS</span><strong>Open</strong></div>
        <div><span>TRADE</span><strong>${escapeHtml(analysis.trade)}</strong></div>
        <div><span>REPORTED</span><strong>${escapeHtml(issue.time || walk.startedAt || "")}</strong></div>
        <div class="wo-header-wide"><span>LIKELY EQUIPMENT / AREA</span><strong>${escapeHtml(analysis.equipment)}</strong></div>
      </div>

      <div class="wo-content-grid ${photo ? "has-photo" : ""}">
        <div class="wo-section wo-observation"><h3>Initial Observation</h3><p>${escapeHtml(analysis.raw)}</p></div>
        ${photo}
      </div>

      <div class="wo-section wo-actions">
        <h3>Suggested Corrective Actions</h3>
        ${analysis.actions.map(action => `<div class="wo-check-line">☐ ${escapeHtml(action)}</div>`).join("")}
      </div>

      <div class="wo-section wo-notes">
        <h3>Technician — Work Performed / Findings</h3>
        <div class="wo-writing-lines"><i></i><i></i><i></i><i></i></div>
      </div>

      <div class="wo-section wo-parts">
        <h3>Parts Used</h3>
        <p class="wo-parts-hint"><strong>Likely materials:</strong> ${escapeHtml(analysis.parts)}</p>
        <table><thead><tr><th>Part Number</th><th>Description</th><th>Qty</th></tr></thead><tbody><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></tbody></table>
      </div>

      <div class="wo-section wo-completion">
        <h3>Completion / Sign-Off</h3>
        <div class="wo-signoff-grid">
          <div><span>COMPLETED BY</span><strong></strong></div>
          <div><span>DATE</span><strong></strong></div>
          <div><span>TIME</span><strong></strong></div>
          <div><span>COMPLETE</span><strong>☐ Yes &nbsp; ☐ Follow-up</strong></div>
        </div>
      </div>

      <p class="wo-footer">Generated by GPT Plant Walk • Work Order Standard v1.0 • ${escapeHtml(number)}</p>
    </section>`;
}

const sprint8OriginalProfessionalReport = window.buildProfessionalReportHtml;
window.buildProfessionalReportHtml = function buildProfessionalReportHtmlSprint8(walk) {
  const base = typeof sprint8OriginalProfessionalReport === "function" ? sprint8OriginalProfessionalReport(walk) : "";
  const host = document.createElement("div");
  host.innerHTML = base;

  host.querySelectorAll(".report-section table tbody tr").forEach((row, index) => {
    const firstCell = row.querySelector("td");
    if (firstCell && walk.issues[index]) firstCell.textContent = analyzeSprint8Observation(walk.issues[index].observation).priority;
  });

  host.querySelectorAll(".compact-report-issue").forEach((box, index) => {
    const paragraphs = box.querySelectorAll("p");
    if (paragraphs[1] && walk.issues[index]) {
      const analysis = analyzeSprint8Observation(walk.issues[index].observation);
      paragraphs[1].innerHTML = `<strong>Preliminary Planning:</strong> ${escapeHtml(analysis.priority)} priority; ${escapeHtml(analysis.trade)} trade. Confirm final scope in the field.`;
    }
  });

  const pages = walk.issues.map((issue, index) => buildSprint8WorkOrderPage(walk, issue, index)).join("");
  return `${host.innerHTML}<section class="work-order-packet-heading"><h2>Printable Work Orders</h2><p>One Work Order Standard v1.0 page is provided for each recorded issue.</p></section>${pages}`;
};

const sprint8OriginalPrompt = window.buildChatGptReport;
window.buildChatGptReport = function buildChatGptReportSprint8(walk) {
  let prompt = typeof sprint8OriginalPrompt === "function" ? sprint8OriginalPrompt(walk) : "";
  prompt = prompt.replace(
    "6. Issue Details With Original Notes",
    `6. Issue Details With Original Notes\n\n7. Completed Work Order Data\nFor each issue, provide final values for Priority, Area / Equipment, Trade, Problem, Recommended Repair, Materials / Parts, Verification, and Confidence. Use the exact Suggested WO # supplied for that issue.`
  );
  return prompt;
};

function applySprint8Version() {
  const footer = document.getElementById("appVersionText");
  if (footer) footer.textContent = `GPT Plant Walk ${SPRINT8_VERSION} — Sprint 8 Alpha 2`;
  try {
    if (typeof activeWalk !== "undefined" && activeWalk) activeWalk.version = SPRINT8_VERSION;
  } catch (error) {
    console.error("Could not apply Sprint 8 version.", error);
  }
}

const sprint8StartButton = document.getElementById("startWalkBtn");
if (sprint8StartButton) sprint8StartButton.addEventListener("click", () => window.setTimeout(applySprint8Version, 0));
window.setTimeout(applySprint8Version, 250);