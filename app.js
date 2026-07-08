const APP_VERSION = "0.4.1-rc1";
const APP_RELEASE_NAME = "Sprint 4.1 RC1";
const STORAGE_KEY = "gptPlantWalks";
const ACTIVE_WALK_KEY = "gptPlantWalkActiveWalk";
const DRAFT_KEY = "gptPlantWalkDraft";
const SELECTED_PHOTOS_KEY = "gptPlantWalkSelectedPhotos";
const MAX_PHOTO_WIDTH = 1400;
const PHOTO_QUALITY = 0.78;
const AUTOSAVE_DELAY_MS = 400;

let walks = safeJsonRead(STORAGE_KEY, []);
let activeWalk = safeJsonRead(ACTIVE_WALK_KEY, null);
let recognition = null;
let isListening = false;
let selectedPhotos = safeJsonRead(SELECTED_PHOTOS_KEY, []);
let draftTimer = null;
let statusTimer = null;

const startWalkBtn = document.getElementById("startWalkBtn");
const viewWalksBtn = document.getElementById("viewWalksBtn");
const activeWalkSection = document.getElementById("activeWalkSection");
const previousWalksSection = document.getElementById("previousWalksSection");
const reportSection = document.getElementById("reportSection");
const walkStartedText = document.getElementById("walkStartedText");
const issueCountBadge = document.getElementById("issueCountBadge");
const issueText = document.getElementById("issueText");
const photoInput = document.getElementById("photoInput");
const selectedPhotoPreview = document.getElementById("selectedPhotoPreview");
const saveIssueBtn = document.getElementById("saveIssueBtn");
const finishWalkBtn = document.getElementById("finishWalkBtn");
const clearDraftBtn = document.getElementById("clearDraftBtn");
const issueList = document.getElementById("issueList");
const walkList = document.getElementById("walkList");
const reportOutput = document.getElementById("reportOutput");
const copyReportBtn = document.getElementById("copyReportBtn");
const printPdfBtn = document.getElementById("printPdfBtn");
const voiceBtn = document.getElementById("voiceBtn");
const professionalReport = document.getElementById("professionalReport");
const statusMessage = document.getElementById("statusMessage");
const onlineStatus = document.getElementById("onlineStatus");
const versionBadge = document.getElementById("versionBadge");
const footerVersion = document.getElementById("footerVersion");
const draftStatus = document.getElementById("draftStatus");
const photoStatus = document.getElementById("photoStatus");
const walkSearch = document.getElementById("walkSearch");

initializeApp();

function initializeApp() {
  bindEvents();
  registerServiceWorker();
  updateVersionDisplay();
  updateOnlineStatus();
  restoreDraft();
  renderSelectedPhotos();
  renderActiveWalkIfPresent();

  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  window.addEventListener("beforeunload", persistCurrentState);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persistCurrentState();
  });
}

function bindEvents() {
  startWalkBtn.addEventListener("click", startWalk);
  viewWalksBtn.addEventListener("click", renderPreviousWalks);
  saveIssueBtn.addEventListener("click", saveIssue);
  finishWalkBtn.addEventListener("click", finishWalk);
  copyReportBtn.addEventListener("click", copyReport);
  printPdfBtn.addEventListener("click", () => window.print());
  voiceBtn.addEventListener("click", toggleVoiceDictation);
  clearDraftBtn.addEventListener("click", clearDraft);
  issueText.addEventListener("input", queueDraftSave);
  photoInput.addEventListener("change", handleSelectedPhotos);
  walkSearch.addEventListener("input", renderWalkList);
}

function updateVersionDisplay() {
  versionBadge.textContent = `v${APP_VERSION}`;
  footerVersion.textContent = `GPT Plant Walk v${APP_VERSION} • ${APP_RELEASE_NAME}`;
}

function updateOnlineStatus() {
  onlineStatus.textContent = navigator.onLine ? "Online" : "Offline";
  onlineStatus.classList.toggle("offline", !navigator.onLine);
}

function renderActiveWalkIfPresent() {
  if (!activeWalk) return;

  activeWalkSection.classList.remove("hidden");
  previousWalksSection.classList.add("hidden");
  reportSection.classList.add("hidden");
  walkStartedText.textContent = `Started: ${formatDateTime(activeWalk.startedAt)}`;
  renderIssues();
  showStatus("Active walk restored.");
}

function startWalk() {
  if (activeWalk) {
    showStatus("A plant walk is already active.");
    activeWalkSection.classList.remove("hidden");
    previousWalksSection.classList.add("hidden");
    reportSection.classList.add("hidden");
    return;
  }

  activeWalk = {
    id: crypto.randomUUID(),
    appVersion: APP_VERSION,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    issues: []
  };

  persistActiveWalk();

  activeWalkSection.classList.remove("hidden");
  previousWalksSection.classList.add("hidden");
  reportSection.classList.add("hidden");
  walkStartedText.textContent = `Started: ${formatDateTime(activeWalk.startedAt)}`;
  renderIssues();
  showStatus("Plant walk started.");
}

function persistWalks() {
  safeJsonWrite(STORAGE_KEY, walks);
}

function persistActiveWalk() {
  safeJsonWrite(ACTIVE_WALK_KEY, activeWalk);
}

function persistCurrentState() {
  if (activeWalk) persistActiveWalk();
  saveDraftNow();
  saveSelectedPhotos();
}

function queueDraftSave() {
  if (draftTimer) clearTimeout(draftTimer);
  draftStatus.textContent = "Saving draft...";
  draftTimer = setTimeout(saveDraftNow, AUTOSAVE_DELAY_MS);
}

function saveDraftNow() {
  const draft = issueText.value;
  localStorage.setItem(DRAFT_KEY, draft);
  draftStatus.textContent = draft.trim() ? "Draft saved." : "Draft autosaves while you type.";
}

function restoreDraft() {
  const draft = localStorage.getItem(DRAFT_KEY);
  if (draft) {
    issueText.value = draft;
    draftStatus.textContent = "Draft restored.";
  }
}

function saveSelectedPhotos() {
  safeJsonWrite(SELECTED_PHOTOS_KEY, selectedPhotos);
}

function clearDraft() {
  const hasDraft = issueText.value.trim() || selectedPhotos.length > 0;
  if (hasDraft && !confirm("Clear the current unsaved observation and selected photos?")) return;

  issueText.value = "";
  photoInput.value = "";
  selectedPhotos = [];
  selectedPhotoPreview.innerHTML = "";
  localStorage.removeItem(DRAFT_KEY);
  localStorage.removeItem(SELECTED_PHOTOS_KEY);
  draftStatus.textContent = "Draft cleared.";
  photoStatus.textContent = "No photos selected.";
}

async function handleSelectedPhotos() {
  const files = Array.from(photoInput.files || []);

  if (files.length === 0) {
    selectedPhotos = [];
    saveSelectedPhotos();
    renderSelectedPhotos();
    return;
  }

  saveIssueBtn.disabled = true;
  photoStatus.textContent = `Processing ${files.length} photo(s)...`;

  try {
    selectedPhotos = [];
    for (const file of files) {
      selectedPhotos.push(await compressPhoto(file));
      renderSelectedPhotos();
    }
    saveSelectedPhotos();
    showStatus(`${selectedPhotos.length} photo(s) ready.`);
  } catch (error) {
    console.error(error);
    showStatus("Photo processing failed. Try taking the photo again.", true);
  } finally {
    saveIssueBtn.disabled = false;
  }
}

function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("File could not be read."));
    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error("Image could not be loaded."));
      image.onload = () => {
        const scale = Math.min(1, MAX_PHOTO_WIDTH / image.width);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);

        resolve({
          id: crypto.randomUUID(),
          name: file.name || "plant-walk-photo.jpg",
          type: "image/jpeg",
          size: file.size,
          capturedAt: new Date().toISOString(),
          dataUrl: canvas.toDataURL("image/jpeg", PHOTO_QUALITY)
        });
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

function renderSelectedPhotos() {
  selectedPhotoPreview.innerHTML = "";

  if (!selectedPhotos.length) {
    photoStatus.textContent = "No photos selected.";
    return;
  }

  photoStatus.textContent = `${selectedPhotos.length} photo(s) selected and autosaved with this draft.`;

  selectedPhotos.forEach((photo, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "photo-tile";
    wrapper.innerHTML = `
      <img src="${photo.dataUrl}" class="photo-preview" alt="Selected photo ${index + 1}" />
      <button type="button" class="remove-photo" data-photo-id="${photo.id}">Remove</button>
    `;
    selectedPhotoPreview.appendChild(wrapper);
  });

  selectedPhotoPreview.querySelectorAll(".remove-photo").forEach(button => {
    button.addEventListener("click", () => {
      selectedPhotos = selectedPhotos.filter(photo => photo.id !== button.dataset.photoId);
      saveSelectedPhotos();
      renderSelectedPhotos();
    });
  });
}

async function saveIssue() {
  const observation = issueText.value.trim();

  if (!activeWalk) {
    alert("Start a plant walk first.");
    return;
  }

  if (!observation && selectedPhotos.length === 0) {
    alert("Enter an observation or attach at least one photo before saving.");
    return;
  }

  const issue = {
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    observation: observation || "Photo-only issue. Add details during report review.",
    photos: selectedPhotos.map(photo => ({ ...photo }))
  };

  activeWalk.issues.push(issue);
  persistActiveWalk();
  clearDraftAfterSave();
  renderIssues();
  showStatus(`Issue ${activeWalk.issues.length} saved.`);
}

function clearDraftAfterSave() {
  issueText.value = "";
  photoInput.value = "";
  selectedPhotos = [];
  selectedPhotoPreview.innerHTML = "";
  localStorage.removeItem(DRAFT_KEY);
  localStorage.removeItem(SELECTED_PHOTOS_KEY);
  draftStatus.textContent = "Draft autosaves while you type.";
  photoStatus.textContent = "No photos selected.";
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
    div.innerHTML = `
      <strong>Issue ${index + 1}</strong>
      <p><strong>Time:</strong> ${escapeHtml(formatTime(issue.time))}</p>
      <p>${escapeHtml(issue.observation)}</p>
      <p><strong>Photos:</strong> ${issue.photos.length}</p>
      <div class="photo-grid"></div>
    `;

    const grid = div.querySelector(".photo-grid");
    issue.photos.forEach((photo, photoIndex) => {
      const img = document.createElement("img");
      img.src = getPhotoSource(photo);
      img.className = "photo-preview";
      img.alt = `Issue ${index + 1} photo ${photoIndex + 1}`;
      grid.appendChild(img);
    });

    issueList.appendChild(div);
  });
}

function renderPreviousWalks() {
  previousWalksSection.classList.remove("hidden");
  activeWalkSection.classList.add("hidden");
  reportSection.classList.add("hidden");
  renderWalkList();
}

function renderWalkList() {
  walkList.innerHTML = "";
  const searchText = walkSearch.value.trim().toLowerCase();
  const finishedWalks = walks
    .filter(walk => walk && walk.finishedAt)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

  const filteredWalks = finishedWalks.filter(walk => {
    if (!searchText) return true;
    return JSON.stringify(walk).toLowerCase().includes(searchText);
  });

  if (filteredWalks.length === 0) {
    walkList.innerHTML = '<p class="muted">No previous walks found.</p>';
    return;
  }

  filteredWalks.forEach(walk => {
    const issueCount = walk.issues.length;
    const photoCount = walk.issues.reduce((total, issue) => total + issue.photos.length, 0);
    const firstPhotos = walk.issues.flatMap(issue => issue.photos).slice(0, 4);
    const div = document.createElement("div");
    div.className = "walk";
    div.innerHTML = `
      <strong>Plant Walk</strong>
      <p><strong>Started:</strong> ${escapeHtml(formatDateTime(walk.startedAt))}</p>
      <p><strong>Total Issues:</strong> ${issueCount}</p>
      <p><strong>Photos:</strong> ${photoCount}</p>
      <div class="thumbnail-row">
        ${firstPhotos.map((photo, index) => `<img src="${getPhotoSource(photo)}" alt="Walk thumbnail ${index + 1}" />`).join("")}
      </div>
      <button data-id="${walk.id}">Generate Report</button>
    `;

    div.querySelector("button").addEventListener("click", () => generateReport(walk.id));
    walkList.appendChild(div);
  });
}

function finishWalk() {
  if (!activeWalk) return;

  if (activeWalk.issues.length === 0) {
    const ok = confirm("This walk has no saved issues. Finish it anyway?");
    if (!ok) return;
  }

  activeWalk.finishedAt = new Date().toISOString();
  walks = walks.filter(walk => walk.id !== activeWalk.id);
  walks.unshift(activeWalk);
  persistWalks();
  persistActiveWalk();

  const finishedWalkId = activeWalk.id;
  activeWalk = null;
  localStorage.removeItem(ACTIVE_WALK_KEY);
  activeWalkSection.classList.add("hidden");
  generateReport(finishedWalkId);
  showStatus("Plant walk finished and report generated.");
}

function generateReport(walkId) {
  const walk = walks.find(item => item.id === walkId) || (activeWalk && activeWalk.id === walkId ? activeWalk : null);
  if (!walk) return;

  reportOutput.value = buildChatGptReport(walk);
  professionalReport.innerHTML = buildProfessionalReportHtml(walk);
  reportSection.classList.remove("hidden");
  previousWalksSection.classList.add("hidden");
}

function buildChatGptReport(walk) {
  let report = `Analyze this plant walk as if you are a maintenance manager and reliability engineer.

Create:
1. Executive Summary
2. Safety Concerns
3. Immediate Repairs
4. Suggested Work Orders
5. Reliability Concerns
6. Engineering Improvements
7. Prioritized Action List
8. Final Professional Plant Walk Report

Plant Walk Started: ${formatDateTime(walk.startedAt)}
Plant Walk Finished: ${walk.finishedAt ? formatDateTime(walk.finishedAt) : "In Progress"}
Total Issues: ${walk.issues.length}
App Version: ${APP_VERSION}

Raw observations:

`;

  walk.issues.forEach((issue, index) => {
    report += `Issue ${index + 1}
Time: ${formatTime(issue.time)}
Observation:
${issue.observation}
Photos: ${issue.photos.length > 0 ? `${issue.photos.length} - embedded in PDF report` : "No"}
--------------------------------

`;
  });

  return report;
}

function buildProfessionalReportHtml(walk) {
  const generatedAt = new Date().toISOString();
  const issueCount = walk.issues.length;
  const photoCount = walk.issues.reduce((total, issue) => total + issue.photos.length, 0);

  let html = `
    <div class="report-header">
      <p class="report-kicker">Maintenance & Reliability</p>
      <h1>Plant Walk Report</h1>
      <p><strong>Started:</strong> ${escapeHtml(formatDateTime(walk.startedAt))}</p>
      <p><strong>Finished:</strong> ${escapeHtml(walk.finishedAt ? formatDateTime(walk.finishedAt) : "In Progress")}</p>
      <p><strong>Generated:</strong> ${escapeHtml(formatDateTime(generatedAt))}</p>
      <p><strong>Total Issues:</strong> ${issueCount}</p>
      <p><strong>Total Photos:</strong> ${photoCount}</p>
      <p><strong>App Version:</strong> ${escapeHtml(APP_VERSION)}</p>
    </div>

    <section class="report-section">
      <h2>1. Executive Summary</h2>
      <p>This plant walk documented ${issueCount} maintenance and reliability observation${issueCount === 1 ? "" : "s"}. The findings should be reviewed by maintenance leadership, converted into work orders where appropriate, and prioritized based on safety, uptime risk, equipment protection, and repeat-failure potential.</p>
    </section>

    <section class="report-section">
      <h2>2. Safety Concerns</h2>
      <p>Review each observation for immediate safety impact, including exposed wiring, damaged guarding, unstable components, pinch points, trip hazards, abnormal heat, stored energy hazards, or unsafe robot/conveyor operation.</p>
    </section>

    <section class="report-section">
      <h2>3. Immediate Repairs</h2>
      <p>Items affecting personnel safety, production uptime, critical assets, electrical integrity, or mechanical failure risk should be inspected and corrected first.</p>
    </section>

    <section class="report-section">
      <h2>4. Suggested Work Orders</h2>
      <ol>
  `;

  walk.issues.forEach((issue, index) => {
    html += `<li><strong>WO-${String(index + 1).padStart(3, "0")}:</strong> Inspect and correct Issue ${index + 1}. Observation: ${escapeHtml(issue.observation)}</li>`;
  });

  html += `
      </ol>
    </section>

    <section class="report-section">
      <h2>5. Reliability Concerns</h2>
      <p>Evaluate observations for developing failure modes such as bearing wear, loose belting, poor cable management, sensor damage, intermittent controls faults, robot repeatability problems, and conditions that may lead to unplanned downtime.</p>
    </section>

    <section class="report-section">
      <h2>6. Engineering Improvements</h2>
      <p>Consider design improvements, guarding updates, cable routing, sensor protection, PM checklist updates, spare parts additions, and condition monitoring where repeat or high-risk issues are identified.</p>
    </section>

    <section class="report-section">
      <h2>7. Prioritized Action List</h2>
      <table class="priority-table">
        <thead><tr><th>Priority</th><th>Action</th><th>Owner</th></tr></thead>
        <tbody>
          <tr><td>High</td><td>Review safety-impacting issues and secure unsafe conditions.</td><td>Maintenance / Engineering</td></tr>
          <tr><td>High</td><td>Create corrective work orders for equipment conditions observed during this walk.</td><td>Maintenance Planner</td></tr>
          <tr><td>Medium</td><td>Evaluate reliability impact and identify repeat-failure patterns.</td><td>Reliability / Engineering</td></tr>
          <tr><td>Low</td><td>Update PMs, inspection routes, and documentation as needed.</td><td>Maintenance Leadership</td></tr>
        </tbody>
      </table>
    </section>

    <section class="report-section">
      <h2>8. Recorded Issues</h2>
  `;

  walk.issues.forEach((issue, index) => {
    html += `
      <div class="report-issue">
        <h3>Issue ${index + 1}</h3>
        <p><strong>Time:</strong> ${escapeHtml(formatTime(issue.time))}</p>
        <p><strong>Observation:</strong></p>
        <p>${escapeHtml(issue.observation)}</p>
        <p><strong>Photos:</strong> ${issue.photos.length}</p>
        <div class="report-photo-grid">
    `;

    issue.photos.forEach((photo, photoIndex) => {
      html += `<figure><img class="report-photo" src="${getPhotoSource(photo)}" alt="Issue ${index + 1} photo ${photoIndex + 1}" /><figcaption>Issue ${index + 1} Photo ${photoIndex + 1}</figcaption></figure>`;
    });

    html += `
        </div>
      </div>
    `;
  });

  html += `
    </section>

    <section class="report-section">
      <h2>Final Professional Plant Walk Report</h2>
      <p>The observations captured in this walk should be reviewed and assigned according to safety risk and production impact. Maintenance should verify each issue in the field, document corrective action, and update equipment history where applicable.</p>
    </section>
  `;

  return html;
}

async function copyReport() {
  try {
    await navigator.clipboard.writeText(reportOutput.value);
    showStatus("Report copied.");
  } catch {
    reportOutput.select();
    document.execCommand("copy");
    showStatus("Report copied.");
  }
}

function toggleVoiceDictation() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Voice dictation is not supported in this browser. You can still use the keyboard microphone on iPhone.");
    return;
  }

  if (!recognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = event => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      issueText.value = `${issueText.value} ${transcript}`.trim();
      saveDraftNow();
    };

    recognition.onerror = event => {
      console.warn("Speech recognition error:", event.error);
      showStatus("Voice dictation stopped. You can use the keyboard microphone.", true);
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

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.remove("hidden", "error");
  statusMessage.classList.toggle("error", isError);

  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusMessage.classList.add("hidden");
  }, 3500);
}

function getPhotoSource(photo) {
  if (typeof photo === "string") return photo;
  return photo.dataUrl;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  });
}

function safeJsonRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn(`Could not read ${key}:`, error);
    return fallback;
  }
}

function safeJsonWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Could not save ${key}:`, error);
    showStatus("Storage failed. Try removing some old walks or photos.", true);
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(error => {
      console.warn("Service worker registration failed:", error);
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
