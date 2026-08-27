const PACKET_SCHEMA_VERSION = "PlantWalkPacketV2";
const PDFBOLT_ENDPOINT = "/api/generate-maintenance-packet";
const MAX_PACKET_REQUEST_BYTES = 3.25 * 1024 * 1024;
const PACKET_PHOTO_MAX_DIMENSION = 720;
const PACKET_PHOTO_JPEG_QUALITY = 0.48;

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

if (typeof window.addEventListener === "function") {
  window.addEventListener("plantwalk:return-to-start", () => {
    currentPacketWalkId = null;
    setPacketStatus("");
  });
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

function buildPacketIssue(issue, index, walk, settings, preparedPhotos = []) {
  const sequence = index + 1;
  const observation = issue.observation || "Photo-only issue. Field verification required.";
  const permanentWorkOrderId = issue.workOrderId || issue.workOrderNumber;
  const workOrderNumber = permanentWorkOrderId && window.plannerSync && typeof window.plannerSync.displayWorkOrderId === "function"
    ? window.plannerSync.displayWorkOrderId(permanentWorkOrderId)
    : permanentWorkOrderId || formatWorkOrderNumber(settings, walk, sequence);
  const photos = preparedPhotos.map((photo, photoIndex) => ({
        url: photo,
        caption: `Issue ${sequence} photo ${photoIndex + 1}`
      }));

  const allowedPriorities = ["Immediate", "Urgent", "Planned", "Monitor"];
  const suppliedPriority = issue.initialPriority || issue.priority;
  const priority = allowedPriorities.includes(suppliedPriority) ? suppliedPriority : "Field verification required";
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

function optimizePhotoForPacket(dataUrl) {
  return new Promise((resolve, reject) => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      resolve(dataUrl);
      return;
    }

    const image = new Image();
    image.onload = () => {
      const longestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
      const scale = longestSide > PACKET_PHOTO_MAX_DIMENSION
        ? PACKET_PHOTO_MAX_DIMENSION / longestSide
        : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
      canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("A report photo could not be prepared for printing."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", PACKET_PHOTO_JPEG_QUALITY));
    };
    image.onerror = () => reject(new Error("A saved report photo could not be read."));
    image.src = dataUrl;
  });
}

async function buildPlantWalkPacket(walk) {
  const settings = readPacketSettings();
  const issues = await Promise.all((walk.issues || []).map(async (issue, index) => {
    const sourcePhotos = Array.isArray(issue.photos) ? issue.photos : [];
    const preparedPhotos = await Promise.all(sourcePhotos.map(optimizePhotoForPacket));
    return buildPacketIssue(issue, index, walk, settings, preparedPhotos);
  }));

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

function packetErrorMessage(errorBody, status) {
  const details = errorBody && errorBody.details;
  const detailMessage = details && typeof details === "object"
    ? details.errorMessage || details.message || details.error || ""
    : typeof details === "string" ? details : "";
  const primary = errorBody && errorBody.error
    ? errorBody.error
    : `Generation failed with status ${status}.`;
  return detailMessage && detailMessage !== primary ? `${primary} ${detailMessage}` : primary;
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
    const packet = await buildPlantWalkPacket(walk);
    const requestBody = JSON.stringify(packet);
    const requestBytes = new TextEncoder().encode(requestBody).byteLength;
    if (requestBytes > MAX_PACKET_REQUEST_BYTES) {
      throw new Error("This packet is still too large to send after preparing its photos. Generate smaller walks or remove duplicate photos, then try again.");
    }
    const response = await fetch(PDFBOLT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(packetErrorMessage(errorBody, response.status));
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
    const message = error instanceof Error ? error.message : String(error);
    setPacketStatus(message, true);
    alert(`${message}\n\nYour saved plant walk and original photos have not been changed.`);
  } finally {
    generatePacketBtn.disabled = false;
  }
}
