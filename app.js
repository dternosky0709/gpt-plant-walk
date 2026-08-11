const APP_VERSION = "1.1.1";
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
const backToStartBtn = $("backToStartBtn");
const voiceBtn = $("voiceBtn");
const appVersionText = $("appVersionText");
const plannerSyncPanel = $("plannerSyncPanel");
const plannerSyncTitle = $("plannerSyncTitle");
const plannerSyncDetail = $("plannerSyncDetail");
const retryPlannerSyncBtn = $("retryPlannerSyncBtn");

startWalkBtn.addEventListener("click", startWalk);
viewWalksBtn.addEventListener("click", renderPreviousWalks);
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
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
initializeApp();
window.addEventListener("online", () => processPlannerQueue());
window.addEventListener("popstate", event => {
  if (event.state && event.state.plantWalkView === "report") return;
  if (!reportSection.classList.contains("hidden")) returnToStart({ updateHistory: false });
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
    div.innerHTML = `<div class="saved-issue-heading"><strong>Issue ${index + 1}</strong><button type="button" class="delete-issue-button" aria-label="Delete Issue ${index + 1}">Delete</button></div><p><strong>Work Order:</strong> ${escapeHtml(issue.workOrderId || "Assigned when saved")}</p><p><strong>Time:</strong> ${escapeHtml(issue.time)}</p><p>${escapeHtml(issue.observation || "Photo-only issue")}</p><p><strong>Photos:</strong> ${issue.photos.length}</p><span class="sync-status ${syncClass}">${syncLabel}</span><div class="photo-grid"></div>`;
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
    const sync = window.plannerSync ? window.plannerSync.summarizeWalkSync(walk) : { synced: 0, pending: 0, failed: 0 };
    const syncText = sync.failed ? `${sync.failed} failed` : sync.pending ? `${sync.pending} pending` : sync.synced ? `${sync.synced} synced` : "Not sent";
    div.innerHTML = `<strong>Plant Walk</strong><p><strong>Started:</strong> ${escapeHtml(walk.startedAt)}</p><p><strong>Status:</strong> ${escapeHtml(walk.status || "completed")}</p><p><strong>Total Issues:</strong> ${walk.issues.length}</p><p><strong>Planner:</strong> ${escapeHtml(syncText)}</p><button data-id="${walk.id}">Open Walk</button>`;
    div.querySelector("button").addEventListener("click", () => generateReport(walk.id));
    walkList.appendChild(div);
  });
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
  } catch (error) {
    console.error("Could not finish walk and queue work orders.", error);
    if (activeWalk) activeWalk.status = "active";
    alert("Unable to finish this walk yet. Your saved observations remain available; please try again.");
  } finally {
    finishWalkBtn.disabled = false;
  }
}

function generateReport(walkId) {
  const walk = walks.find(item => item.id === walkId);
  if (!walk) return;
  reportedWalkId = walk.id;
  renderPlannerSyncStatus(walk);
  reportSection.classList.remove("hidden");
  previousWalksSection.classList.add("hidden");
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
        activeWalkSection.classList.add("hidden");
        previousWalksSection.classList.add("hidden");
        reportSection.classList.add("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.dispatchEvent(new CustomEvent("plantwalk:return-to-start"));
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
