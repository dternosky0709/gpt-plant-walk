const APP_VERSION = "1.3.0";
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
let deletingIssueId = null;
let reportedWalkId = null;
let plannerSyncInProgress = false;

const $ = id => document.getElementById(id);
const startWalkBtn = $("startWalkBtn");
const resumeWalkBtn = $("resumeWalkBtn");
const homeSection = $("homeSection");
const currentWalkTitle = $("currentWalkTitle");
const currentWalkDetail = $("currentWalkDetail");
const activeWalkSection = $("activeWalkSection");
const previousWalksSection = $("previousWalksSection");
const gallerySection = $("gallerySection");
const galleryGrid = $("galleryGrid");
const workOrderDetailSection = $("workOrderDetailSection");
const workOrderDetail = $("workOrderDetail");
const backToGalleryBtn = $("backToGalleryBtn");
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
const backToStartBtn = $("backToStartBtn");
const voiceBtn = $("voiceBtn");
const appVersionText = $("appVersionText");
const plannerSyncPanel = $("plannerSyncPanel");
const plannerSyncTitle = $("plannerSyncTitle");
const plannerSyncDetail = $("plannerSyncDetail");
const retryPlannerSyncBtn = $("retryPlannerSyncBtn");
const homeNavBtn = $("homeNavBtn");
const galleryNavBtn = $("galleryNavBtn");
const settingsNavBtn = $("settingsNavBtn");

startWalkBtn.addEventListener("click", startWalk);
resumeWalkBtn.addEventListener("click", resumeCurrentWalk);
homeNavBtn.addEventListener("click", handleHomeNavigation);
galleryNavBtn.addEventListener("click", () => openPhotoGallery());
backToGalleryBtn.addEventListener("click", () => {
  if (history.state && history.state.plantWalkView === "work-order") history.back();
  else openPhotoGallery();
});
saveIssueBtn.addEventListener("click", saveIssue);
finishWalkBtn.addEventListener("click", finishWalk);
backToStartBtn.addEventListener("click", () => returnToStart());
voiceBtn.addEventListener("click", toggleVoiceDictation);
clearDraftBtn.addEventListener("click", clearDraft);
retryPlannerSyncBtn.addEventListener("click", retryReportedWalkSync);
issueText.addEventListener("input", saveDraft);
photoInput.addEventListener("change", handleSelectedPhotos);

if (appVersionText) appVersionText.textContent = `GPT Plant Walk ${APP_VERSION}`;
updateSaveIssueButtonState();
registerServiceWorker();
initializeApp();
window.addEventListener("online", () => processPlannerQueue());
window.addEventListener("popstate", event => {
  if (event.state && event.state.plantWalkView === "gallery") return openPhotoGallery({ updateHistory: false });
  if (event.state && event.state.plantWalkView === "work-order") {
    return openGalleryWorkOrder(event.state.walkId, event.state.issueId, event.state.photoIndex, { updateHistory: false });
  }
  if (event.state && event.state.plantWalkView === "report") return;
  if (!reportSection.classList.contains("hidden")) returnToStart({ updateHistory: false });
  else handleHomeNavigation();
});

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
  await migrateUnsyncedWorkOrderIds();
  await reconcileCompletedWalkQueues();
  await restoreInterruptedWalk();
  renderIssues();
  updateHomeStatus();
  processPlannerQueue().catch(error => console.error("Could not process Planner queue.", error));
  if (!history.state || !history.state.plantWalkView) history.replaceState({ plantWalkView: "start" }, "");
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
  activeWalkSection.classList.add("hidden");
  previousWalksSection.classList.add("hidden");
  reportSection.classList.add("hidden");
  walkStartedText.textContent = `Started: ${activeWalk.startedAt}`;
  await restoreDraftForActiveWalk();
  updateHomeStatus();
}

function startWalk() {
  if (activeWalk && activeWalk.status !== "completed") {
    if (confirm("A plant walk is already active. Continue that walk instead of starting a new one?")) {
      homeSection.classList.add("hidden");
      activeWalkSection.classList.remove("hidden");
      previousWalksSection.classList.add("hidden");
      reportSection.classList.add("hidden");
      walkStartedText.textContent = `Started: ${activeWalk.startedAt}`;
      renderIssues();
      updateHomeStatus();
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
  homeSection.classList.add("hidden");
  activeWalkSection.classList.remove("hidden");
  previousWalksSection.classList.add("hidden");
  reportSection.classList.add("hidden");
  walkStartedText.textContent = `Started: ${activeWalk.startedAt}`;
  renderIssues();
  updateHomeStatus();
}

function resumeCurrentWalk() {
  if (!activeWalk || activeWalk.status === "completed") return;
  homeSection.classList.add("hidden");
  activeWalkSection.classList.remove("hidden");
  previousWalksSection.classList.add("hidden");
  reportSection.classList.add("hidden");
  walkStartedText.textContent = `Started: ${activeWalk.startedAt}`;
  renderIssues();
  setActiveNavigation("home");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateHomeStatus() {
  const hasActiveWalk = Boolean(activeWalk && activeWalk.status !== "completed");
  resumeWalkBtn.classList.toggle("hidden", !hasActiveWalk);
  currentWalkTitle.textContent = hasActiveWalk ? "Walk in progress" : "No active walk";
  currentWalkDetail.textContent = hasActiveWalk
    ? `${activeWalk.issues.length} ${activeWalk.issues.length === 1 ? "issue" : "issues"} saved · Started ${activeWalk.startedAt}`
    : "Start a walk when you are ready.";
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

    const observedAt = new Date();
    const issueId = crypto.randomUUID();
    const baseWorkOrderId = typeof window.allocateWorkOrderNumber === "function"
      ? window.allocateWorkOrderNumber(observedAt)
      : `WO-${observedAt.getTime()}`;
    const workOrderId = window.plannerSync && typeof window.plannerSync.ensureGlobalWorkOrderId === "function"
      ? window.plannerSync.ensureGlobalWorkOrderId(baseWorkOrderId, issueId)
      : `${baseWorkOrderId}-${issueId.replace(/[^A-Za-z0-9]/g, "").slice(0, 12).toUpperCase()}`;
    activeWalk.issues.push({
      id: issueId,
      time: observedAt.toLocaleTimeString(),
      observedAt: observedAt.toISOString(),
      observation,
      photos: [...selectedPhotos],
      workOrderId,
      initialPriority: "Planned",
      syncStatus: "not_queued",
      syncEventId: null,
      plannerAcceptedAt: null,
      lastSyncAttemptAt: null,
      syncError: null
    });
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
    const syncLabel = issue.syncStatus === "synced" ? "Synced" : issue.syncStatus === "sync_failed" ? "Sync failed" : issue.syncStatus === "pending_sync" ? "Pending sync" : "Created";
    const syncClass = issue.syncStatus === "synced" ? "synced" : issue.syncStatus === "sync_failed" ? "failed" : "pending";
    const displayedWorkOrderId = window.plannerSync && typeof window.plannerSync.displayWorkOrderId === "function"
      ? window.plannerSync.displayWorkOrderId(issue.workOrderId)
      : issue.workOrderId;
    div.innerHTML = `<div class="saved-issue-heading"><strong>Issue ${index + 1}</strong><button type="button" class="delete-issue-button" aria-label="Delete Issue ${index + 1}">Delete</button></div><p><strong>Work Order:</strong> ${escapeHtml(displayedWorkOrderId || "Assigned when saved")}</p><p><strong>Time:</strong> ${escapeHtml(issue.time)}</p><p>${escapeHtml(issue.observation || "Photo-only issue")}</p><p><strong>Photos:</strong> ${issue.photos.length}</p><span class="sync-status ${syncClass}">${syncLabel}</span><div class="photo-grid"></div>`;
    const deleteButton = div.querySelector(".delete-issue-button");
    deleteButton.disabled = deletingIssueId !== null;
    deleteButton.addEventListener("click", () => deleteIssue(issue.id, index + 1));
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

async function deleteIssue(issueId, issueNumber) {
  if (!activeWalk || deletingIssueId !== null || !window.issueDeletion) return;
  deletingIssueId = issueId;
  renderIssues();

  try {
    const result = await window.issueDeletion.deleteSavedIssue({
      walk: activeWalk,
      issueId,
      confirmDelete: () => confirm(`Delete Issue ${issueNumber}? This removes its saved observation and photo from this walk.`),
      persist: persistWalks
    });
    if (result.status === "deleted") {
      if (!previousWalksSection.classList.contains("hidden")) renderPreviousWalks();
      if (!reportSection.classList.contains("hidden")) generateReport(activeWalk.id);
    }
  } catch (error) {
    console.error("deleteIssue: error", error);
    alert(`Unable to delete issue: ${error && error.message ? error.message : error}`);
  } finally {
    deletingIssueId = null;
    renderIssues();
  }
}

function hideGalleryViews() {
  gallerySection.classList.add("hidden");
  workOrderDetailSection.classList.add("hidden");
}

function openPhotoGallery({ updateHistory = true } = {}) {
  const appSettingsSection = $("settingsSection");
  const appDashboardSection = $("dashboardSection");
  if (appSettingsSection) appSettingsSection.classList.add("hidden");
  if (appDashboardSection) appDashboardSection.classList.remove("hidden");
  homeSection.classList.add("hidden");
  activeWalkSection.classList.add("hidden");
  previousWalksSection.classList.add("hidden");
  reportSection.classList.add("hidden");
  workOrderDetailSection.classList.add("hidden");
  gallerySection.classList.remove("hidden");
  renderPhotoGallery();
  setActiveNavigation("gallery");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (updateHistory && (!history.state || history.state.plantWalkView !== "gallery")) {
    history.pushState({ plantWalkView: "gallery" }, "");
  }
}

function renderPhotoGallery() {
  galleryGrid.innerHTML = "";
  const photos = window.photoGallery ? window.photoGallery.collectGalleryPhotos(walks) : [];
  if (!photos.length) {
    galleryGrid.innerHTML = '<p class="muted gallery-empty">No photos from completed walks yet.</p>';
    return;
  }
  photos.forEach(item => {
    const displayedWorkOrderId = window.plannerSync && typeof window.plannerSync.displayWorkOrderId === "function"
      ? window.plannerSync.displayWorkOrderId(item.workOrderNumber)
      : item.workOrderNumber;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-item";
    button.setAttribute("aria-label", `Open work order ${displayedWorkOrderId || `for Issue ${item.issueOrder}`}`);
    const image = document.createElement("img");
    image.src = item.photo;
    image.alt = `Issue ${item.issueOrder} photo`;
    const label = document.createElement("span");
    label.textContent = displayedWorkOrderId || `Issue ${item.issueOrder}`;
    const date = document.createElement("small");
    date.textContent = item.completedAt || "Date unavailable";
    button.append(image, label, date);
    button.addEventListener("click", () => openGalleryWorkOrder(item.walkId, item.issueId, item.photoIndex));
    galleryGrid.appendChild(button);
  });
}

function syncStatusLabel(issue) {
  if (issue.syncStatus === "synced") return "Synced to Maintenance Planner";
  if (issue.syncStatus === "sync_failed") return "Planner synchronization needs attention";
  if (issue.syncStatus === "pending_sync") return "Pending Planner synchronization";
  return "Not sent to Maintenance Planner";
}

function openGalleryWorkOrder(walkId, issueId, photoIndex = 0, { updateHistory = true } = {}) {
  const walk = walks.find(item => item.id === walkId && item.status === "completed");
  const issueIndex = walk ? walk.issues.findIndex(item => item.id === issueId) : -1;
  const issue = issueIndex >= 0 ? walk.issues[issueIndex] : null;
  if (!walk || !issue) return openPhotoGallery({ updateHistory });
  const photos = Array.isArray(issue.photos) ? issue.photos : [];
  const selectedPhotoIndex = Number.isInteger(photoIndex) && photos[photoIndex] ? photoIndex : 0;
  const displayedWorkOrderId = window.plannerSync && typeof window.plannerSync.displayWorkOrderId === "function"
    ? window.plannerSync.displayWorkOrderId(issue.workOrderId)
    : issue.workOrderId;
  const aiIssue = walk.analysis && walk.analysis.provider === "openai"
    ? walk.analysis.issues.find(item => item.issueId === issue.id)
    : null;
  const priority = aiIssue ? aiIssue.priority : issue.initialPriority || "Planned";
  const trade = aiIssue ? aiIssue.trade : "Field verification required";
  const recommendation = aiIssue ? aiIssue.recommendation : "Field verification required";

  workOrderDetail.innerHTML = `<p class="section-kicker amber">WORK ORDER</p><div class="detail-title-row"><h2>${escapeHtml(displayedWorkOrderId || `Issue ${issueIndex + 1}`)}</h2><span class="priority-pill">${escapeHtml(priority)}</span></div><div class="work-order-detail-meta"><p><strong>Walk completed</strong><span>${escapeHtml(walk.endedAt || walk.completedAt || "Field verification required")}</span></p><p><strong>Issue</strong><span>${issueIndex + 1} of ${walk.issues.length}</span></p><p><strong>Planner</strong><span>${escapeHtml(syncStatusLabel(issue))}</span></p><p><strong>Trade</strong><span>${escapeHtml(trade)}</span></p></div><div id="detailPhotoFrame" class="detail-photo-frame"></div><section class="detail-observation"><span>ORIGINAL OBSERVATION</span><p>${escapeHtml(issue.observation || "Photo-only issue")}</p></section><section class="detail-recommendation"><span>${aiIssue ? "AI-GENERATED · REVIEW REQUIRED" : "CORRECTIVE WORK"}</span><p>${escapeHtml(recommendation)}</p></section><section class="detail-closeout"><span>TECHNICIAN CLOSEOUT</span><p>Corrective action taken: ____________________________________</p><p>Parts used: _______________________________________________</p><p>Completion date / repair time: ______________________________</p></section>`;
  const photoFrame = $("detailPhotoFrame");
  if (photos.length) {
    const image = document.createElement("img");
    image.src = photos[selectedPhotoIndex];
    image.alt = `${displayedWorkOrderId || `Issue ${issueIndex + 1}`} photo ${selectedPhotoIndex + 1}`;
    photoFrame.appendChild(image);
    const count = document.createElement("small");
    count.textContent = `Photo ${selectedPhotoIndex + 1} of ${photos.length}`;
    photoFrame.appendChild(count);
  }

  const appSettingsSection = $("settingsSection");
  const appDashboardSection = $("dashboardSection");
  if (appSettingsSection) appSettingsSection.classList.add("hidden");
  if (appDashboardSection) appDashboardSection.classList.remove("hidden");
  homeSection.classList.add("hidden");
  activeWalkSection.classList.add("hidden");
  previousWalksSection.classList.add("hidden");
  reportSection.classList.add("hidden");
  gallerySection.classList.add("hidden");
  workOrderDetailSection.classList.remove("hidden");
  setActiveNavigation("gallery");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (updateHistory) history.pushState({ plantWalkView: "work-order", walkId, issueId, photoIndex: selectedPhotoIndex }, "");
}

function renderPreviousWalks() {
  homeSection.classList.add("hidden");
  hideGalleryViews();
  previousWalksSection.classList.remove("hidden");
  activeWalkSection.classList.add("hidden");
  reportSection.classList.add("hidden");
  walkList.innerHTML = "";
  const completedWalks = walks.filter(walk => walk.status === "completed");
  if (completedWalks.length === 0) {
    walkList.innerHTML = '<p class="muted">No previous walks yet.</p>';
    return;
  }
  completedWalks.forEach(walk => {
    const div = document.createElement("div");
    div.className = "walk";
    const sync = window.plannerSync ? window.plannerSync.summarizeWalkSync(walk) : { synced: 0, pending: 0, failed: 0 };
    const syncText = sync.failed ? `${sync.failed} failed` : sync.pending ? `${sync.pending} pending` : sync.synced ? `${sync.synced} synced` : "Not sent";
    const observations = (walk.issues || []).map((issue, index) => `<li><strong>Issue ${index + 1}:</strong> ${escapeHtml(issue.observation || "Photo-only issue")}</li>`).join("");
    const analysis = walk.analysis && walk.analysis.provider === "openai" ? walk.analysis : null;
    const aiIssueDetails = analysis ? analysis.issues.map(issue => `<li><strong>Issue ${issue.order} · ${escapeHtml(issue.priority)}</strong><span>${escapeHtml(issue.trade)}</span><p>${escapeHtml(issue.recommendation)}</p></li>`).join("") : "";
    const analysisHtml = analysis
      ? `<div class="ai-walk-summary"><span>AI-GENERATED · REVIEW REQUIRED</span><p>${escapeHtml(analysis.summary)}</p><details><summary>View issue analysis</summary><ol>${aiIssueDetails}</ol></details></div>`
      : walk.analysisStatus === "analyzing"
        ? '<div class="ai-walk-summary is-pending"><span>AI ANALYSIS</span><p>Analysis in progress…</p></div>'
        : `<div class="ai-walk-summary is-unavailable"><span>AI ANALYSIS</span><p>${escapeHtml(walk.analysisError || "No AI summary has been generated for this walk.")}</p><button type="button" class="secondary compact-button" data-action="analyze" data-id="${walk.id}">GENERATE AI SUMMARY</button></div>`;
    div.innerHTML = `<div class="history-card-heading"><strong>Plant Walk</strong><span>${walk.issues.length} ${walk.issues.length === 1 ? "issue" : "issues"}</span></div><p><strong>Started:</strong> ${escapeHtml(walk.startedAt)}</p><p><strong>Completed:</strong> ${escapeHtml(walk.endedAt || "Field verification required")}</p><p><strong>Planner:</strong> ${escapeHtml(syncText)}</p>${analysisHtml}<div class="walk-observation-summary"><strong>Items recorded</strong><ol>${observations || "<li>No observations recorded.</li>"}</ol></div><div class="history-actions"><button type="button" data-action="open" data-id="${walk.id}">OPEN WALK</button><button type="button" class="danger" data-action="delete" data-id="${walk.id}">DELETE WALK</button></div>`;
    div.querySelector('[data-action="open"]').addEventListener("click", () => generateReport(walk.id));
    div.querySelector('[data-action="delete"]').addEventListener("click", () => deleteCompletedWalk(walk.id));
    const analyzeButton = div.querySelector('[data-action="analyze"]');
    if (analyzeButton) analyzeButton.addEventListener("click", () => analyzeCompletedWalk(walk));
    walkList.appendChild(div);
  });
}

window.renderWalkHistory = renderPreviousWalks;

async function deleteCompletedWalk(walkId) {
  const walk = walks.find(item => item.id === walkId && item.status === "completed");
  if (!walk) return;
  const confirmed = confirm(`Delete this completed walk and its ${walk.issues.length} saved ${walk.issues.length === 1 ? "issue" : "issues"} from this phone? Work orders already sent to Maintenance Planner will remain there.`);
  if (!confirmed) return;
  const originalWalks = walks;
  walks = walks.filter(item => item.id !== walkId);
  try {
    await persistWalks();
  } catch (error) {
    walks = originalWalks;
    console.error("Could not delete completed walk.", error);
    alert("Unable to delete this walk. Nothing was removed.");
    return;
  }
  try {
    if (window.appStorage && typeof window.appStorage.deleteSyncEventsForWalk === "function") {
      await window.appStorage.deleteSyncEventsForWalk(walkId);
    }
  } catch (error) {
    console.error("Could not clean up deleted walk synchronization records.", error);
  }
  renderPreviousWalks();
}

async function finishWalk() {
  if (!activeWalk) return;
  finishWalkBtn.disabled = true;
  try {
    activeWalk.status = "completed";
    const completedAt = new Date();
    activeWalk.endedAt = completedAt.toLocaleString();
    activeWalk.completedAt = completedAt.toISOString();
    await queueWalkForPlanner(activeWalk);
    await persistWalks();
    persistActiveWalkId();
    clearDraft();
    generateReport(activeWalk.id);
    activeWalk = null;
    persistActiveWalkId();
    activeWalkSection.classList.add("hidden");
    await processPlannerQueue({ force: true, walkId: reportedWalkId });
    await analyzeCompletedWalk(walks.find(walk => walk.id === reportedWalkId));
  } catch (error) {
    console.error("Could not finish walk and queue work orders.", error);
    if (activeWalk) activeWalk.status = "active";
    alert("Unable to finish this walk yet. Your saved observations remain available; please try again.");
  } finally {
    finishWalkBtn.disabled = false;
  }
}

async function analyzeCompletedWalk(walk) {
  if (!walk || walk.status !== "completed" || walk.analysisStatus === "analyzing") return;
  walk.analysisStatus = "analyzing";
  walk.analysisError = null;
  await persistWalks();
  if (!previousWalksSection.classList.contains("hidden")) renderPreviousWalks();

  try {
    const analysisWalk = {
      ...walk,
      site: window.gptPlantWalkSettings && window.gptPlantWalkSettings.plantName || null,
      issues: (walk.issues || []).map(issue => ({ ...issue, photos: [] }))
    };
    const service = window.aiService.createConfiguredAiService({
      providerMode: "openai-server",
      model: "gpt-5.6-terra",
      apiEndpoint: "/api/analyze-walk",
      requestTimeoutMs: 30000,
      retryCount: 1,
      retryPolicy: "fixed",
      maxOutputTokens: 2048,
      featureFlags: { photoAnalysis: false }
    });
    const analysis = await service.analyzeWalk(analysisWalk);
    if (analysis.provider !== "openai") throw new Error("Live AI is not available on this deployment.");
    walk.analysis = JSON.parse(JSON.stringify(analysis));
    walk.analysisStatus = "completed";
    walk.analysisCompletedAt = new Date().toISOString();
  } catch (error) {
    console.error("AI analysis failed.", error);
    walk.analysis = null;
    walk.analysisStatus = "failed";
    walk.analysisError = "AI summary unavailable. Your original observations remain saved.";
  }
  await persistWalks();
  if (!previousWalksSection.classList.contains("hidden")) renderPreviousWalks();
}

function generateReport(walkId) {
  const walk = walks.find(item => item.id === walkId);
  if (!walk) return;
  reportedWalkId = walk.id;
  renderPlannerSyncStatus(walk);
  homeSection.classList.add("hidden");
  reportSection.classList.remove("hidden");
  previousWalksSection.classList.add("hidden");
  hideGalleryViews();
  if (!history.state || history.state.plantWalkView !== "report" || history.state.walkId !== walk.id) {
    history.pushState({ plantWalkView: "report", walkId: walk.id }, "");
  }
}

async function queueWalkForPlanner(walk) {
  if (!window.appStorage || !window.plannerSync) return;
  const plantName = window.gptPlantWalkSettings && window.gptPlantWalkSettings.plantName || "";
  for (const issue of walk.issues) {
    if (!issue.workOrderId || issue.syncStatus === "synced") continue;
    const existingEvent = issue.syncEventId && typeof window.appStorage.getSyncEvent === "function"
      ? await window.appStorage.getSyncEvent(issue.syncEventId)
      : null;
    if (existingEvent) continue;
    if (!issue.observedAt) issue.observedAt = new Date().toISOString();
    const payload = window.plannerSync.buildIntakePayload({ walk, issue, plantName, eventId: issue.syncEventId || null });
    issue.syncStatus = "pending_sync";
    issue.syncEventId = payload.eventId;
    issue.syncError = null;
    await window.appStorage.putSyncEvent({
      eventId: payload.eventId,
      walkId: walk.id,
      observationId: issue.id,
      workOrderId: issue.workOrderId,
      payload,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: new Date().toISOString(),
      lastError: null,
      acceptedAt: null
    });
  }
}

async function migrateUnsyncedWorkOrderIds() {
  if (!window.appStorage || !window.plannerSync || typeof window.plannerSync.ensureGlobalWorkOrderId !== "function") return;
  const events = typeof window.appStorage.loadSyncEvents === "function" ? await window.appStorage.loadSyncEvents() : [];
  const eventMap = new Map(events.map(event => [event.eventId, event]));
  let changed = false;

  for (const walk of walks) {
    for (const issue of Array.isArray(walk.issues) ? walk.issues : []) {
      const event = issue.syncEventId ? eventMap.get(issue.syncEventId) : null;
      if (event && event.status === "accepted") {
        if (issue.syncStatus !== "synced") {
          issue.syncStatus = "synced";
          issue.plannerAcceptedAt = event.acceptedAt || issue.plannerAcceptedAt || null;
          issue.syncError = null;
          changed = true;
        }
        continue;
      }
      if (issue.syncStatus === "synced" || !issue.id || !issue.workOrderId) continue;

      const nextWorkOrderId = window.plannerSync.ensureGlobalWorkOrderId(issue.workOrderId, issue.id);
      if (nextWorkOrderId === issue.workOrderId) continue;
      issue.workOrderId = nextWorkOrderId;
      issue.syncError = null;
      if (walk.status === "completed") issue.syncStatus = "pending_sync";

      if (event) {
        const payload = {
          ...event.payload,
          workOrder: { ...event.payload.workOrder, id: nextWorkOrderId }
        };
        await window.appStorage.putSyncEvent({
          ...event,
          workOrderId: nextWorkOrderId,
          payload,
          status: "pending",
          nextAttemptAt: new Date().toISOString(),
          lastError: null
        });
      }
      changed = true;
    }
  }

  if (changed) await persistWalks();
}

async function reconcileCompletedWalkQueues() {
  if (!window.appStorage || !window.plannerSync) return;
  let changed = false;
  for (const walk of walks.filter(item => item.status === "completed")) {
    const before = walk.issues.map(issue => issue.syncEventId || "").join("|");
    await queueWalkForPlanner(walk);
    if (before !== walk.issues.map(issue => issue.syncEventId || "").join("|")) changed = true;
  }
  if (changed) await persistWalks();
}

function findQueuedIssue(event) {
  const walk = walks.find(item => item.id === event.walkId);
  const issue = walk && walk.issues.find(item => item.id === event.observationId);
  return { walk, issue };
}

async function processPlannerQueue({ force = false, walkId = null } = {}) {
  if (plannerSyncInProgress || !navigator.onLine || !window.appStorage || typeof window.appStorage.loadSyncEvents !== "function") return;
  plannerSyncInProgress = true;
  try {
    const now = Date.now();
    const events = (await window.appStorage.loadSyncEvents()).filter(event => {
      if (event.status === "accepted") return false;
      if (walkId && event.walkId !== walkId) return false;
      if (force) return true;
      return event.status !== "failed" && (!event.nextAttemptAt || Date.parse(event.nextAttemptAt) <= now);
    });

    for (const event of events) {
      const { issue } = findQueuedIssue(event);
      if (!issue) continue;
      issue.lastSyncAttemptAt = new Date().toISOString();
      try {
        const response = await fetch(window.plannerSync.SYNC_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event.payload)
        });
        let result = {};
        try { result = await response.json(); } catch {}
        if (!response.ok || result.intakeStatus !== "accepted" || result.workOrderId !== issue.workOrderId) {
          const code = result && result.error && result.error.code || `HTTP_${response.status}`;
          const error = new Error(result && result.error && result.error.message || "Maintenance Planner rejected the work order.");
          error.code = code;
          error.permanent = response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429;
          throw error;
        }
        issue.syncStatus = "synced";
        issue.plannerAcceptedAt = result.acceptedAt || new Date().toISOString();
        issue.syncError = null;
        await window.appStorage.putSyncEvent({ ...event, status: "accepted", acceptedAt: issue.plannerAcceptedAt, lastError: null, nextAttemptAt: null });
      } catch (error) {
        const attemptCount = Number(event.attemptCount || 0) + 1;
        const permanent = Boolean(error && error.permanent);
        const message = error && error.message ? error.message : "Planner is currently unavailable.";
        issue.syncStatus = permanent ? "sync_failed" : "pending_sync";
        issue.syncError = message;
        await window.appStorage.putSyncEvent({
          ...event,
          status: permanent ? "failed" : "pending",
          attemptCount,
          lastError: message,
          nextAttemptAt: permanent ? null : window.plannerSync.nextRetryAt(attemptCount)
        });
      }
      await persistWalks();
      if (reportedWalkId) {
        const reportedWalk = walks.find(item => item.id === reportedWalkId);
        if (reportedWalk) renderPlannerSyncStatus(reportedWalk);
      }
    }
  } finally {
    plannerSyncInProgress = false;
    if (!previousWalksSection.classList.contains("hidden")) renderPreviousWalks();
  }
}

function renderPlannerSyncStatus(walk) {
  if (!plannerSyncPanel || !window.plannerSync) return;
  const summary = window.plannerSync.summarizeWalkSync(walk);
  plannerSyncPanel.classList.remove("is-synced", "is-pending", "is-failed");
  retryPlannerSyncBtn.classList.add("hidden");
  if (summary.total === 0) {
    plannerSyncTitle.textContent = "No work orders in this walk";
    plannerSyncDetail.textContent = "There is nothing to send to Maintenance Planner.";
    return;
  }
  if (summary.failed > 0) {
    plannerSyncPanel.classList.add("is-failed");
    plannerSyncTitle.textContent = `${summary.failed} work order${summary.failed === 1 ? "" : "s"} need attention`;
    const failedIssue = (walk.issues || []).find(issue => issue.syncStatus === "sync_failed" && issue.syncError);
    plannerSyncDetail.textContent = failedIssue
      ? `${summary.synced} of ${summary.total} accepted. ${failedIssue.syncError}`
      : `${summary.synced} of ${summary.total} accepted by Maintenance Planner.`;
    retryPlannerSyncBtn.classList.remove("hidden");
    return;
  }
  if (summary.synced === summary.total) {
    plannerSyncPanel.classList.add("is-synced");
    plannerSyncTitle.textContent = "All work orders synced";
    plannerSyncDetail.textContent = `${summary.synced} of ${summary.total} accepted by Maintenance Planner.`;
    return;
  }
  plannerSyncPanel.classList.add("is-pending");
  plannerSyncTitle.textContent = navigator.onLine ? "Sending work orders" : "Work orders queued offline";
  plannerSyncDetail.textContent = `${summary.synced} of ${summary.total} synced; ${summary.pending + summary.notQueued} pending.`;
  retryPlannerSyncBtn.classList.remove("hidden");
}

async function retryReportedWalkSync() {
  if (!reportedWalkId) return;
  retryPlannerSyncBtn.disabled = true;
  await processPlannerQueue({ force: true, walkId: reportedWalkId });
  retryPlannerSyncBtn.disabled = false;
  const walk = walks.find(item => item.id === reportedWalkId);
  if (walk) renderPlannerSyncStatus(walk);
}

async function returnToStart({ updateHistory = true } = {}) {
  if (!window.walkReset) return;
  backToStartBtn.disabled = true;
  const walkId = reportedWalkId;

  try {
    await window.walkReset.resetCompletedWalk({
      walkId,
      clearDraft: async id => {
        if (window.appStorage && typeof window.appStorage.clearDraft === "function") {
          if (id) await window.appStorage.clearDraft(id);
        } else {
          localStorage.removeItem(DRAFT_KEY);
        }
      },
      clearActiveWalk: () => {
        activeWalk = null;
        persistActiveWalkId();
        reportedWalkId = null;
      },
      clearForm: () => {
        if (recognition && isListening) recognition.stop();
        isListening = false;
        clearIssueEntryForm();
        renderIssues();
      },
      showStart: () => {
        homeSection.classList.remove("hidden");
        activeWalkSection.classList.add("hidden");
        previousWalksSection.classList.add("hidden");
        reportSection.classList.add("hidden");
        hideGalleryViews();
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.dispatchEvent(new CustomEvent("plantwalk:return-to-start"));
        updateHomeStatus();
        setActiveNavigation("home");
      }
    });
    if (updateHistory) history.replaceState({ plantWalkView: "start" }, "");
  } catch (error) {
    console.error("Could not return to the start screen.", error);
    alert("Unable to return to the start screen. Your completed walk is still saved.");
  } finally {
    backToStartBtn.disabled = false;
  }
}

function handleHomeNavigation() {
  const reportIsOpen = !reportSection.classList.contains("hidden");
  if (reportIsOpen && reportedWalkId) {
    returnToStart();
    return;
  }

  const appSettingsSection = $("settingsSection");
  const appDashboardSection = $("dashboardSection");
  if (appSettingsSection) appSettingsSection.classList.add("hidden");
  if (appDashboardSection) appDashboardSection.classList.remove("hidden");
  homeSection.classList.remove("hidden");
  activeWalkSection.classList.add("hidden");
  previousWalksSection.classList.add("hidden");
  reportSection.classList.add("hidden");
  hideGalleryViews();
  updateHomeStatus();
  setActiveNavigation("home");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setActiveNavigation(view) {
  homeNavBtn.classList.toggle("is-active", view === "home");
  galleryNavBtn.classList.toggle("is-active", view === "gallery");
  settingsNavBtn.classList.toggle("is-active", view === "settings");
}

function restoreNavigationForVisibleView() {
  setActiveNavigation(!gallerySection.classList.contains("hidden") || !workOrderDetailSection.classList.contains("hidden") ? "gallery" : "home");
}

window.setPlantWalkNavigation = setActiveNavigation;
window.restorePlantWalkNavigation = restoreNavigationForVisibleView;

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing || sessionStorage.getItem("plantWalkUpdateReloaded") === APP_VERSION) return;
    refreshing = true;
    sessionStorage.setItem("plantWalkUpdateReloaded", APP_VERSION);
    window.location.reload();
  });
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
    .then(registration => registration.update())
    .catch(error => console.error("Could not update the offline app.", error));
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
