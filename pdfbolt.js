const PACKET_SCHEMA_VERSION = "PlantWalkPacketV2";
const PDFBOLT_ENDPOINT = "/api/generate-maintenance-packet";

let currentPacketWalkId = null;

const generatePacketBtn = document.getElementById("generatePacketBtn");
const packetStatus = document.getElementById("packetStatus");

if (typeof generateReport === "function") {
  const originalGenerateReport = generateReport;
  generateReport = function wrappedGenerateReport(walkId) {
    currentPacketWalkId = walkId;
    return originalGenerateReport(walkId);
  };
}

if (generatePacketBtn) {
  generatePacketBtn.addEventListener("click", generateMaintenancePacket);
}

function readPacketSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("gptPlantWalkSettings"));
    return saved && typeof saved === "object" ? saved : {};
  } catch (error) {
    console.warn("Could not read packet settings.", error);
    return {};
  }
}

function sanitizeWorkOrderPart(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatWorkOrderNumber(settings, walk, sequence) {
  const date = new Date(walk.startedAt);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = String(safeDate.getFullYear());
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  const digits = Math.max(2, Number(settings.sequenceDigits) || 3);
  const start = Math.max(1, Number(settings.sequenceStart) || 1);
  const seq = String(start + sequence - 1).padStart(digits, "0");
  const company = sanitizeWorkOrderPart(settings.companyName || "WO");
  const format = String(settings.workOrderFormat || "WO-{DATE}-{SEQ}").toUpperCase();

  return format
    .replaceAll("{COMPANY}", company)
    .replaceAll("{DATE}", `${year}${month}${day}`)
    .replaceAll("{YEAR}", year)
    .replaceAll("{MONTH}", month)
    .replaceAll("{DAY}", day)
    .replaceAll("{SEQ}", seq);
}

function buildPacketIssue(issue, index, walk, settings) {
  const sequence = index + 1;
  const observation = issue.observation || "Photo-only issue. Field verification required.";
  const workOrderNumber = formatWorkOrderNumber(settings, walk, sequence);
  const photos = Array.isArray(issue.photos)
    ? issue.photos.map((photo, photoIndex) => ({
        url: photo,
        caption: `Issue ${sequence} photo ${photoIndex + 1}`
      }))
    : [];

  const allowedPriorities = ["Immediate", "Urgent", "Planned", "Monitor"];
  const priority = allowedPriorities.includes(issue.priority) ? issue.priority : "Field verification required";
  const correctiveWork = Array.isArray(issue.correctiveWork)
    ? issue.correctiveWork.filter(Boolean)
    : Array.isArray(issue.repairSteps)
      ? issue.repairSteps.filter(Boolean)
      : [];

  return {
    sequence,
    workOrderNumber,
    timeObserved: issue.time || "Not recorded",
    priority,
    priorityClass: allowedPriorities.includes(priority) ? priority.toLowerCase() : "unverified",
    trade: issue.trade || "Field verification required",
    area: issue.area || "Field verification required",
    equipment: issue.equipment || "Field verification required",
    originalObservation: observation,
    conditionSummary: issue.conditionSummary || issue.conditionAssessment || "Field verification required",
    likelyFailureMode: issue.likelyFailureMode || "Field verification required",
    operationalImpact: issue.operationalImpact || issue.operationalRisk || "Field verification required",
    safetyConsiderations: issue.safetyConsiderations || issue.safetyImpact || "Field verification required",
    aiConfidence: issue.aiConfidence || issue.confidence || "Field verification required",
    correctiveWork,
    recommendedAction: correctiveWork[0] || "Field verification required",
    photos,
    singlePhoto: photos.length === 1
  };
}

function buildPlantWalkPacket(walk) {
  const settings = readPacketSettings();
  const issues = (walk.issues || []).map((issue, index) => buildPacketIssue(issue, index, walk, settings));

  return {
    schemaVersion: PACKET_SCHEMA_VERSION,
    company: {
      name: settings.companyName || "GPT Plant Walk",
      plant: settings.plantName || "Internal Maintenance",
      logoUrl: settings.companyLogo || ""
    },
    report: {
      title: "Plant Walk Maintenance Packet",
      walkId: walk.id,
      inspector: "Plant Walk User",
      startedAt: walk.startedAt,
      completedAt: walk.endedAt || "Not completed",
      generatedAt: new Date().toLocaleString(),
      totalIssues: issues.length,
      packetVersion: "v2.0",
      managementAttention: ["Field verification is required before management priorities are assigned."],
      safetyOperationalRisks: ["Review each issue and apply site-specific safety procedures before work begins."]
    },
    issues
  };
}

function setPacketStatus(message, isError = false) {
  if (!packetStatus) return;
  packetStatus.textContent = message;
  packetStatus.classList.toggle("error-message", isError);
  packetStatus.classList.toggle("hidden", !message);
}

function getCurrentPacketWalk() {
  if (!currentPacketWalkId) return null;
  return Array.isArray(walks) ? walks.find(walk => walk.id === currentPacketWalkId) : null;
}

async function generateMaintenancePacket() {
  const walk = getCurrentPacketWalk();
  if (!walk) {
    alert("Open a completed plant walk before generating the maintenance packet.");
    return;
  }

  if (!Array.isArray(walk.issues) || walk.issues.length === 0) {
    alert("This plant walk has no saved issues.");
    return;
  }

  generatePacketBtn.disabled = true;
  setPacketStatus("Generating maintenance packet…");

  try {
    const packet = buildPlantWalkPacket(walk);
    const response = await fetch(PDFBOLT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(packet)
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody && errorBody.error ? errorBody.error : `Generation failed with status ${response.status}.`);
    }

    const pdfBlob = await response.blob();
    const downloadUrl = URL.createObjectURL(pdfBlob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `GPT-Plant-Walk-${walk.id}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 30000);

    setPacketStatus("Maintenance packet generated successfully.");
  } catch (error) {
    console.error("Could not generate maintenance packet.", error);
    setPacketStatus(error instanceof Error ? error.message : String(error), true);
    alert("The maintenance packet could not be generated. Your saved plant walk has not been changed.");
  } finally {
    generatePacketBtn.disabled = false;
  }
}
