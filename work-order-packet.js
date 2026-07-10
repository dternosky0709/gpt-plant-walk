(() => {
  const SPRINT8_VERSION = "v0.9.1-alpha2";
  const baseBuilder = window.buildProfessionalReportHtml;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function settings() {
    return window.gptPlantWalkSettings || {};
  }

  function woNumber(index, walk) {
    const current = settings();
    const sequence = Math.max(1, Number(current.sequenceStart) || 1) + index;
    const date = walk && walk.startedAt ? new Date(walk.startedAt) : new Date();
    if (typeof window.generateWorkOrderNumber === "function") {
      return window.generateWorkOrderNumber(sequence, Number.isNaN(date.getTime()) ? new Date() : date, current);
    }
    return `WO-${String(sequence).padStart(Number(current.sequenceDigits) || 3, "0")}`;
  }

  function analyzeObservation(observation) {
    const raw = String(observation || "Photo-only issue").trim();
    const text = raw.toLowerCase();

    let priority = "Planned";
    if (/seat belt|exposed wire|guard missing|fire|smoke|sparking|production down|not running|broken safety|leak.*electrical/.test(text)) priority = "Immediate";
    else if (/dropping|big cut|broken|very slow|really slow|noisy|bearing|overheat|vibrat|leak|not cooling|fault|jam/.test(text)) priority = "Urgent";
    else if (/monitor|watch|check later|minor/.test(text)) priority = "Monitor";

    let trade = "Mechanical";
    if (/robot|plc|hmi|sensor|program|recipe|position|teach|servo/.test(text)) trade = "Controls / Mechanical";
    else if (/wire|electrical|motor|drive|vfd|breaker|power|fan/.test(text)) trade = "Electrical / Mechanical";
    else if (/roof|hvac|air condition|ac unit|building|door|plumbing/.test(text)) trade = "Facilities";
    else if (/housekeeping|debris|trash|cleanup|spill/.test(text)) trade = "Housekeeping";

    let equipment = raw;
    if (raw.length > 62) equipment = `${raw.slice(0, 59)}...`;

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
      actions.push("Identify the active leak path, protect equipment/material below, and inspect the roof above the reported area.");
      actions.push("Repair the penetration or roofing defect and verify during the next rainfall or controlled water test.");
    }
    if (/not cooling|hvac|ac unit|air condition/.test(text)) {
      actions.push("Verify thermostat, power, filter, airflow, condensate, icing, and obvious electrical conditions.");
      actions.push("Schedule qualified HVAC service for refrigerant, compressor, controls, and sealed-system diagnosis.");
    }
    if (!actions.length) {
      actions.push("Verify the reported condition in the field and identify the failure point before disassembly.");
      actions.push("Repair or replace the affected component, then test the equipment under normal operating conditions.");
    }

    let parts = "As required after field inspection";
    if (/bearing/.test(text)) parts = "Bearing, seals, approved lubricant, and retaining hardware as required";
    else if (/belt/.test(text)) parts = "Replacement belt or approved repair materials, splice/lacing, and tracking hardware";
    else if (/seat belt/.test(text)) parts = "Manufacturer-approved complete seat-belt assembly and mounting hardware";
    else if (/fan/.test(text)) parts = "Fan blade, motor, fasteners, or complete fan assembly as required";

    return { priority, trade, equipment, actions, parts, observation: raw };
  }

  function branding() {
    const current = settings();
    const logo = current.companyLogo ? `<img class="wo-logo" src="${current.companyLogo}" alt="Company logo">` : "";
    const company = current.companyName ? `<strong>${esc(current.companyName)}</strong>` : `<strong>Maintenance Department</strong>`;
    const plant = current.plantName ? `<span>${esc(current.plantName)}</span>` : "";
    return `<div class="wo-brand">${logo}<div>${company}${plant}</div></div>`;
  }

  function photoHtml(issue) {
    if (!issue.photos || !issue.photos.length) return "";
    return `<div class="wo-photo-wrap"><img class="wo-photo" src="${issue.photos[0]}" alt="Issue photo"></div>`;
  }

  function workOrderPage(issue, index, walk) {
    const a = analyzeObservation(issue.observation);
    const number = woNumber(index, walk);
    return `<section class="work-order-sheet">
      <div class="wo-topline">
        ${branding()}
        <div class="wo-title"><span>MAINTENANCE WORK ORDER</span><strong>${esc(number)}</strong></div>
      </div>

      <div class="wo-info-grid">
        <div><span>Priority</span><strong>${esc(a.priority)}</strong></div>
        <div><span>Status</span><strong>Open</strong></div>
        <div><span>Trade</span><strong>${esc(a.trade)}</strong></div>
        <div><span>Reported</span><strong>${esc(issue.time || walk.startedAt || "")}</strong></div>
        <div class="wo-wide"><span>Likely Equipment / Area</span><strong>${esc(a.equipment)}</strong></div>
      </div>

      <div class="wo-two-column">
        <div class="wo-card wo-observation">
          <h3>Initial Observation</h3>
          <p>${esc(a.observation)}</p>
        </div>
        ${photoHtml(issue)}
      </div>

      <div class="wo-card wo-actions">
        <h3>Suggested Corrective Actions</h3>
        ${a.actions.map(action => `<p class="wo-check">☐ ${esc(action)}</p>`).join("")}
      </div>

      <div class="wo-card wo-notes">
        <h3>Technician — Work Performed / Findings</h3>
        <div class="wo-writing-lines"><i></i><i></i><i></i><i></i></div>
      </div>

      <div class="wo-card wo-parts">
        <h3>Parts Used</h3>
        <p class="wo-suggested-parts"><strong>Likely materials:</strong> ${esc(a.parts)}</p>
        <table><thead><tr><th>Part Number</th><th>Description</th><th>Qty</th></tr></thead><tbody><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></tbody></table>
      </div>

      <div class="wo-card wo-completion">
        <h3>Completion / Sign-Off</h3>
        <div class="wo-completion-grid">
          <div><span>Completed By</span><b></b></div>
          <div><span>Date</span><b></b></div>
          <div><span>Time</span><b></b></div>
          <div><span>Complete</span><p>☐ Yes &nbsp; ☐ Follow-up</p></div>
        </div>
      </div>
    </section>`;
  }

  function updateExistingReport(htmlText, walk) {
    const host = document.createElement("div");
    host.innerHTML = htmlText;

    const rows = host.querySelectorAll(".report-section table tbody tr");
    rows.forEach((row, index) => {
      const cells = row.querySelectorAll("td");
      if (cells[0] && walk.issues[index]) cells[0].textContent = analyzeObservation(walk.issues[index].observation).priority;
    });

    host.querySelectorAll(".compact-report-issue").forEach((box, index) => {
      const plan = box.querySelectorAll("p")[1];
      if (plan && walk.issues[index]) {
        const a = analyzeObservation(walk.issues[index].observation);
        plan.innerHTML = `<strong>Preliminary Planning:</strong> ${esc(a.priority)} priority; ${esc(a.trade)} trade. Final scope should be confirmed in the field.`;
      }
    });

    return host.innerHTML;
  }

  window.buildProfessionalReportHtml = function sprint8Report(walk) {
    const base = typeof baseBuilder === "function" ? baseBuilder(walk) : "";
    const updated = updateExistingReport(base, walk);
    const packet = walk.issues.map((issue, index) => workOrderPage(issue, index, walk)).join("");
    return `${updated}<div class="work-order-packet">${packet}</div>`;
  };

  const footer = document.getElementById("appVersionText") || document.querySelector("footer p");
  if (footer) footer.textContent = `GPT Plant Walk ${SPRINT8_VERSION} — Sprint 8 Alpha 2`;
})();