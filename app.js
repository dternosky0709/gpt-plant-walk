const APP_VERSION = "v0.7.3-alpha4";
const STORAGE_KEY = "gptPlantWalks";
const DRAFT_KEY = "gptPlantWalkDraft";
const ACTIVE_WALK_KEY = "gptPlantWalkActiveWalkId";

let walks = [];
let activeWalk = null;
let recognition = null;
let isListening = false;
let selectedPhotos = [];
let isProcessingPhotos = false;
let photoConversionError = false;

const $ = id => document.getElementById(id);
const startWalkBtn = $("startWalkBtn");
const viewWalksBtn = $("viewWalksBtn");
const activeWalkSection = $("activeWalkSection");
const previousWalksSection = $("previousWalksSection");
const reportSection = $("reportSection");
const walkStartedText = $("walkStartedText");
const issueCountBadge = $("issueCountBadge");
const issueText = $("issueText");
const photoInput = $("photoInput");
const selectedPhotoPreview = $("selectedPhotoPreview");
const saveIssueBtn = $("saveIssueBtn");
const finishWalkBtn = $("finishWalkBtn");
const clearDraftBtn = $("clearDraftBtn");
const issueList = $("issueList");
const walkList = $("walkList");
const reportOutput = $("reportOutput");
const copyReportBtn = $("copyReportBtn");
const printPdfBtn = $("printPdfBtn");
const voiceBtn = $("voiceBtn");
const professionalReport = $("professionalReport");
const appVersionText = $("appVersionText");

startWalkBtn.addEventListener("click", startWalk);
viewWalksBtn.addEventListener("click", renderPreviousWalks);
saveIssueBtn.addEventListener("click", saveIssue);
finishWalkBtn.addEventListener("click", finishWalk);
copyReportBtn.addEventListener("click", copyReport);
printPdfBtn.addEventListener("click", () => window.print());
voiceBtn.addEventListener("click", toggleVoiceDictation);
clearDraftBtn.addEventListener("click", clearDraft);
issueText.addEventListener("input", saveDraft);
photoInput.addEventListener("change", handleSelectedPhotos);

if (appVersionText) appVersionText.textContent = `GPT Plant Walk ${APP_VERSION}`;
updateSaveIssueButtonState();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
initializeApp();

async function initializeApp() {
  try {
    if (window.appStorage && typeof window.appStorage.initializeStorage === "function") {
      const state = await window.appStorage.initializeStorage();
      walks = Array.isArray(state && state.walks) ? state.walks : [];
    } else {
      walks = await loadWalks();
    }
  } catch (error) {
    console.error("Could not initialize storage.", error);
    walks = [];
  }

  const activeWalkId = localStorage.getItem(ACTIVE_WALK_KEY);
  activeWalk = activeWalkId ? walks.find(walk => walk.id === activeWalkId && walk.status !== "completed") || null : null;
  await restoreInterruptedWalk();
  renderIssues();
}

async function loadWalks() {
  if (window.appStorage && typeof window.appStorage.loadWalks === "function") return window.appStorage.loadWalks();
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function persistWalks() {
  if (window.appStorage && typeof window.appStorage.saveWalks === "function") {
    return window.appStorage.saveWalks(walks).catch(error => {
      console.error("Could not persist walks.", error);
      throw error;
    });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(walks));
  return Promise.resolve();
}

function persistActiveWalkId() {
  if (activeWalk) localStorage.setItem(ACTIVE_WALK_KEY, activeWalk.id);
  else localStorage.removeItem(ACTIVE_WALK_KEY);
}

function saveDraft() {
  if (!activeWalk) return;
  const draft = { walkId: activeWalk.id, observation: issueText.value, updatedAt: new Date().toISOString() };
  if (window.appStorage && typeof window.appStorage.saveDraft === "function") {
    window.appStorage.saveDraft({ ...draft, photos: selectedPhotos }).catch(error => console.error("Could not save draft.", error));
    return;
  }
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

async function readDraft() {
  if (window.appStorage && typeof window.appStorage.loadDraft === "function") return window.appStorage.loadDraft(activeWalk ? activeWalk.id : null);
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAFT_KEY));
    return parsed && parsed.walkId ? { walkId: parsed.walkId, observation: parsed.observation || "", photos: [] } : null;
  } catch {
    return null;
  }
}

async function restoreDraftForActiveWalk() {
  if (!activeWalk) return;
  const draft = await readDraft();
  if (!draft || draft.walkId !== activeWalk.id) return;
  issueText.value = draft.observation || "";
  selectedPhotos = Array.isArray(draft.photos) ? draft.photos : [];
  renderSelectedPhotos();
}

function clearDraft() {
  clearIssueEntryForm();
  if (window.appStorage && typeof window.appStorage.clearDraft === "function") {
    window.appStorage.clearDraft(activeWalk ? activeWalk.id : null).catch(error => console.error("Could not clear draft.", error));
    return;
  }
  localStorage.removeItem(DRAFT_KEY);
}

function clearIssueEntryForm() {
  issueText.value = "";
  photoInput.value = "";
  selectedPhotos = [];
  isProcessingPhotos = false;
  photoConversionError = false;
  updateSaveIssueButtonState();
  renderSelectedPhotos();
}

function updateSaveIssueButtonState() {
  saveIssueBtn.disabled = isProcessingPhotos;
}

async function restoreInterruptedWalk() {
  if (!activeWalk) {
    localStorage.removeItem(ACTIVE_WALK_KEY);
    if (window.appStorage && typeof window.appStorage.clearDraft === "function") await window.appStorage.clearDraft(null).catch(() => {});
    return;
  }
  activeWalkSection.classList.remove("hidden");
  previousWalksSection.classList.add("hidden");
  reportSection.classList.add("hidden");
  walkStartedText.textContent = `Started: ${activeWalk.startedAt}`;
  await restoreDraftForActiveWalk();
}

function startWalk() {
  if (activeWalk && activeWalk.status !== "completed") {
    if (confirm("A plant walk is already active. Continue that walk instead of starting a new one?")) {
      activeWalkSection.classList.remove("hidden");
      previousWalksSection.classList.add("hidden");
      reportSection.classList.add("hidden");
      walkStartedText.textContent = `Started: ${activeWalk.startedAt}`;
      renderIssues();
      return;
    }
    activeWalk.status = "completed";
    activeWalk.endedAt = new Date().toLocaleString();
  }

  clearDraft();
  activeWalk = { id: crypto.randomUUID(), version: APP_VERSION, status: "active", startedAt: new Date().toLocaleString(), endedAt: null, issues: [] };
  walks.unshift(activeWalk);
  persistWalks();
  persistActiveWalkId();
  activeWalkSection.classList.remove("hidden");
  previousWalksSection.classList.add("hidden");
  reportSection.classList.add("hidden");
  walkStartedText.textContent = `Started: ${activeWalk.startedAt}`;
  renderIssues();
}

async function handleSelectedPhotos() {
  const files = Array.from(photoInput.files || []);
  if (files.length === 0) {
    selectedPhotos = [];
    isProcessingPhotos = false;
    photoConversionError = false;
    updateSaveIssueButtonState();
    renderSelectedPhotos();
    saveDraft();
    return;
  }

  selectedPhotos = [];
  isProcessingPhotos = true;
  photoConversionError = false;
  updateSaveIssueButtonState();
  renderSelectedPhotos();
  saveDraft();

  try {
    selectedPhotos = await convertPhotosToBase64(files, 10000);
    isProcessingPhotos = false;
    updateSaveIssueButtonState();
    renderSelectedPhotos();
    saveDraft();
  } catch (error) {
    console.error("Could not convert selected photos.", error);
    selectedPhotos = [];
    isProcessingPhotos = false;
    photoConversionError = true;
    updateSaveIssueButtonState();
    renderSelectedPhotos();
    alert("Unable to process the selected photo(s). Please try another photo or try again.");
  }
}

function renderSelectedPhotos() {
  selectedPhotoPreview.innerHTML = "";
  if (isProcessingPhotos) selectedPhotoPreview.appendChild(statusText("Processing photo(s)..."));
  else if (photoConversionError) selectedPhotoPreview.appendChild(statusText("Photo processing failed. Please try another photo."));
  else if (selectedPhotos.length > 0) selectedPhotoPreview.appendChild(statusText("Photos ready. Save Issue enabled."));

  selectedPhotos.forEach(photo => {
    const img = document.createElement("img");
    img.src = photo;
    img.className = "photo-preview";
    selectedPhotoPreview.appendChild(img);
  });
}

function statusText(text) {
  const p = document.createElement("p");
  p.className = "muted";
  p.textContent = text;
  return p;
}

async function saveIssue() {
  try {
    const observation = issueText.value.trim();
    if (!activeWalk) return alert("Start a plant walk first.");
    if (!observation && selectedPhotos.length === 0) return alert("Enter an observation or attach a photo before saving.");

    activeWalk.issues.push({ id: crypto.randomUUID(), time: new Date().toLocaleTimeString(), observation, photos: [...selectedPhotos] });
    await persistWalks();
    clearDraft();
    renderIssues();
  } catch (error) {
    console.error("saveIssue: error", error);
    alert(`Unable to save issue: ${error && error.message ? error.message : error}`);
  }
}

function convertPhotosToBase64(files, timeoutMs = 10000) {
  return Promise.all(Array.from(files || []).map(file => new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(`Photo processing timed out: ${file.name}`)), timeoutMs);
    const reader = new FileReader();
    reader.onload = event => {
      window.clearTimeout(timeoutId);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 900 / img.width);
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error(`Could not prepare photo canvas: ${file.name}`));
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.55));
      };
      img.onerror = () => reject(new Error(`Could not read photo: ${file.name}`));
      img.src = event.target.result;
    };
    reader.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error(`Could not read file: ${file.name}`));
    };
    reader.readAsDataURL(file);
  })));
}

function renderIssues() {
  issueList.innerHTML = "";
  const issueCount = activeWalk ? activeWalk.issues.length : 0;
  issueCountBadge.textContent = `${issueCount} ${issueCount === 1 ? "Issue" : "Issues"}`;
  if (!activeWalk || activeWalk.issues.length === 0) {
    issueList.innerHTML = '<p class="muted">No issues saved yet.</p>';
    return;
  }

  activeWalk.issues.forEach((issue, index) => {
    const div = document.createElement("div");
    div.className = "issue";
    div.innerHTML = `<strong>Issue ${index + 1}</strong><p><strong>Time:</strong> ${escapeHtml(issue.time)}</p><p>${escapeHtml(issue.observation || "Photo-only issue")}</p><p><strong>Photos:</strong> ${issue.photos.length}</p><div class="photo-grid"></div>`;
    const grid = div.querySelector(".photo-grid");
    issue.photos.forEach(photo => {
      const img = document.createElement("img");
      img.src = photo;
      img.className = "photo-preview";
      grid.appendChild(img);
    });
    issueList.appendChild(div);
  });
}

function renderPreviousWalks() {
  previousWalksSection.classList.remove("hidden");
  activeWalkSection.classList.add("hidden");
  reportSection.classList.add("hidden");
  walkList.innerHTML = "";
  if (walks.length === 0) {
    walkList.innerHTML = '<p class="muted">No previous walks yet.</p>';
    return;
  }
  walks.forEach(walk => {
    const div = document.createElement("div");
    div.className = "walk";
    div.innerHTML = `<strong>Plant Walk</strong><p><strong>Started:</strong> ${escapeHtml(walk.startedAt)}</p><p><strong>Status:</strong> ${escapeHtml(walk.status || "completed")}</p><p><strong>Total Issues:</strong> ${walk.issues.length}</p><button data-id="${walk.id}">Generate Report</button>`;
    div.querySelector("button").addEventListener("click", () => generateReport(walk.id));
    walkList.appendChild(div);
  });
}

function finishWalk() {
  if (!activeWalk) return;
  activeWalk.status = "completed";
  activeWalk.endedAt = new Date().toLocaleString();
  persistWalks();
  persistActiveWalkId();
  clearDraft();
  generateReport(activeWalk.id);
  activeWalk = null;
  persistActiveWalkId();
  activeWalkSection.classList.add("hidden");
}

function generateReport(walkId) {
  const walk = walks.find(item => item.id === walkId);
  if (!walk) return;
  reportOutput.value = buildChatGptReport(walk);
  professionalReport.innerHTML = buildProfessionalReportHtml(walk);
  reportSection.classList.remove("hidden");
  previousWalksSection.classList.add("hidden");
}

function buildChatGptReport(walk) {
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
WO-001: [Short work order title]
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

PLANT WALK DETAILS
Walk Started: ${walk.startedAt}
Walk Ended: ${walk.endedAt || "Not completed"}
Total Issues: ${walk.issues.length}
App Version: ${walk.version || APP_VERSION}

RAW OBSERVATIONS

`;

  walk.issues.forEach((issue, index) => {
    const wo = String(index + 1).padStart(3, "0");
    report += `Issue ${index + 1}
Suggested WO #: WO-${wo}
Time: ${issue.time}
Observation:
${issue.observation || "Photo-only issue"}
Photos: ${issue.photos.length > 0 ? `Yes - ${issue.photos.length} photo(s) embedded in the PDF report` : "No"}
Instruction: Infer likely equipment, priority name, trade, repair steps, parts/materials, verification, and reliability/engineering notes from this issue.
--------------------------------

`;
  });
  return report;
}

function buildProfessionalReportHtml(walk) {
  const totalPhotos = walk.issues.reduce((count, issue) => count + issue.photos.length, 0);
  let html = `<div class="report-header"><p class="report-kicker">MAINTENANCE PLANNING</p><h1>Plant Walk Report</h1><p><strong>Started:</strong> ${escapeHtml(walk.startedAt)}</p><p><strong>Ended:</strong> ${escapeHtml(walk.endedAt || "Not completed")}</p><p><strong>Total Issues:</strong> ${walk.issues.length}</p><p><strong>Total Photos:</strong> ${totalPhotos}</p><p><strong>App Version:</strong> ${escapeHtml(walk.version || APP_VERSION)}</p></div>
<section class="report-section"><h2>1. Maintenance Summary</h2><p>This walk captured ${walk.issues.length} maintenance observation${walk.issues.length === 1 ? "" : "s"}. Use the ChatGPT-ready report text to generate the final maintenance summary, named work priorities, repair guidance, and reliability recommendations from the original notes and photos.</p></section>
<section class="report-section"><h2>2. Prioritized Action List</h2><table><thead><tr><th>Priority</th><th>Issue</th><th>Suggested WO</th><th>Action</th></tr></thead><tbody>`;

  walk.issues.forEach((issue, index) => {
    const wo = String(index + 1).padStart(3, "0");
    html += `<tr><td>AI to assign</td><td>Issue ${index + 1}</td><td>WO-${wo}</td><td>${escapeHtml(issue.observation || "Photo-only issue")}</td></tr>`;
  });

  html += `</tbody></table></section><section class="report-section"><h2>3. Suggested Work Orders</h2>`;
  walk.issues.forEach((issue, index) => {
    const wo = String(index + 1).padStart(3, "0");
    html += `<div class="report-issue compact-report-issue"><h3>WO-${wo}: Issue ${index + 1}</h3><p><strong>Original Observation:</strong> ${escapeHtml(issue.observation || "Photo-only issue")}</p><p><strong>AI Planning Needed:</strong> Determine priority name, likely equipment/area, trade, failure mode, repair steps, materials, verification, and confidence from the observation and photo(s).</p></div>`;
  });

  html += `</section><section class="report-section"><h2>4. Mechanical / Maintenance Repair Notes</h2><p>ChatGPT should provide practical repair guidance for each issue, including likely inspection points, adjustments, replacement steps, parts or materials, and post-repair checks.</p></section><section class="report-section"><h2>5. Reliability / Engineering Notes</h2><p>ChatGPT should identify PM improvements, spare parts needs, repeat-failure concerns, and engineering improvements such as access changes, guarding, cable management, sensor protection, or design changes.</p></section><section class="report-section"><h2>6. Issue Details With Original Notes</h2>`;

  walk.issues.forEach((issue, index) => {
    html += `<div class="report-issue"><h3>Issue ${index + 1}</h3><p><strong>Time:</strong> ${escapeHtml(issue.time)}</p><p><strong>Observation:</strong></p><p>${escapeHtml(issue.observation || "Photo-only issue")}</p><p><strong>Photos:</strong> ${issue.photos.length}</p><div class="report-photo-grid">`;
    issue.photos.forEach(photo => {
      html += `<img class="report-photo" src="${photo}" alt="Issue photo" />`;
    });
    html += `</div></div>`;
  });

  html += `</section>`;
  return html;
}

function copyReport() {
  reportOutput.select();
  document.execCommand("copy");
  alert("AI prompt copied. Attach the raw Plant Walk PDF in ChatGPT so photos are included in the analysis.");
}

function focusObservationField() {
  issueText.focus({ preventScroll: false });
  issueText.scrollIntoView({ behavior: "smooth", block: "center" });
  issueText.setSelectionRange(issueText.value.length, issueText.value.length);
}

function toggleVoiceDictation() {
  focusObservationField();
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return alert("Voice dictation is not supported in this browser. You can still use the keyboard microphone on iPhone.");
  if (!recognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = event => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      issueText.value = `${issueText.value} ${transcript}`.trim();
      focusObservationField();
      saveDraft();
    };
    recognition.onend = () => {
      isListening = false;
      voiceBtn.textContent = "Start Voice Dictation";
    };
  }
  if (isListening) {
    recognition.stop();
    isListening = false;
    voiceBtn.textContent = "Start Voice Dictation";
  } else {
    recognition.start();
    isListening = true;
    voiceBtn.textContent = "Stop Voice Dictation";
  }
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
