const APP_VERSION = "v0.5.0-alpha7";
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
const appVersionText = document.getElementById("appVersionText");

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

if (appVersionText) {
  appVersionText.textContent = `GPT Plant Walk ${APP_VERSION}`;
}

updateSaveIssueButtonState();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

initializeApp();

async function initializeApp() {
  try {
    if (window.appStorage && typeof window.appStorage.initializeStorage === "function") {
      const storageState = await window.appStorage.initializeStorage();
      walks = Array.isArray(storageState && storageState.walks) ? storageState.walks : [];
    } else {
      walks = (await loadWalks()) || [];
    }
  } catch (error) {
    console.error("Could not initialize walks from storage.", error);
    walks = [];
  }

  const activeWalkId = localStorage.getItem(ACTIVE_WALK_KEY);
  if (activeWalkId) {
    activeWalk = walks.find(walk => walk.id === activeWalkId && walk.status !== "completed") || null;
  }

  await restoreInterruptedWalk();
  renderIssues();
}

async function loadWalks() {
  if (window.appStorage && typeof window.appStorage.loadWalks === "function") {
    return window.appStorage.loadWalks();
  }

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    console.error("Could not load saved walks.", error);
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
  if (activeWalk) {
    localStorage.setItem(ACTIVE_WALK_KEY, activeWalk.id);
  } else {
    localStorage.removeItem(ACTIVE_WALK_KEY);
  }
}

function saveDraft() {
  if (!activeWalk) return;

  const draft = {
    walkId: activeWalk.id,
    observation: issueText.value,
    updatedAt: new Date().toISOString()
  };

  if (window.appStorage && typeof window.appStorage.saveDraft === "function") {
    window.appStorage.saveDraft({
      ...draft,
      photos: selectedPhotos
    }).catch(error => {
      console.error("Could not save draft.", error);
    });
    return;
  }

  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

async function restoreDraftForActiveWalk() {
  if (!activeWalk) return;

  const draft = await readDraft();
  if (!draft || draft.walkId !== activeWalk.id) return;

  issueText.value = draft.observation || "";
  selectedPhotos = Array.isArray(draft.photos) ? draft.photos : [];
  renderSelectedPhotos();
}

async function readDraft() {
  if (window.appStorage && typeof window.appStorage.loadDraft === "function") {
    return window.appStorage.loadDraft(activeWalk ? activeWalk.id : null);
  }

  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === "object" && "walkId" in parsed) {
      return {
        walkId: parsed.walkId,
        observation: parsed.observation || "",
        photos: []
      };
    }

    return null;
  } catch {
    return null;
  }
}

function clearDraft() {
  issueText.value = "";
  photoInput.value = "";
  selectedPhotos = [];
  isProcessingPhotos = false;
  photoConversionError = false;
  updateSaveIssueButtonState();
  renderSelectedPhotos();

  if (window.appStorage && typeof window.appStorage.clearDraft === "function") {
    window.appStorage.clearDraft(activeWalk ? activeWalk.id : null).catch(error => {
      console.error("Could not clear draft.", error);
    });
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
  const activeWalkId = localStorage.getItem(ACTIVE_WALK_KEY);
  if (!activeWalkId) {
    if (window.appStorage && typeof window.appStorage.clearDraft === "function") {
      await window.appStorage.clearDraft(null).catch(() => {});
    }
    return;
  }

  activeWalk = walks.find(walk => walk.id === activeWalkId && walk.status !== "completed") || null;

  if (!activeWalk) {
    localStorage.removeItem(ACTIVE_WALK_KEY);
    if (window.appStorage && typeof window.appStorage.clearDraft === "function") {
      await window.appStorage.clearDraft(null).catch(() => {});
    }
    return;
  }

  activeWalkSection.classList.remove("hidden");
  previousWalksSection.classList.add("hidden");
  reportSection.classList.add("hidden");

  walkStartedText.textContent = `Started: ${activeWalk.startedAt}`;
  await restoreDraftForActiveWalk();
  renderIssues();
}

function startWalk() {
  if (activeWalk && activeWalk.status !== "completed") {
    const continueWalk = confirm("A plant walk is already active. Continue that walk instead of starting a new one?");
    if (continueWalk) {
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
  clearIssueEntryForm();

  activeWalk = {
    id: crypto.randomUUID(),
    version: APP_VERSION,
    status: "active",
    startedAt: new Date().toLocaleString(),
    endedAt: null,
    issues: []
  };

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
    photoConversionError = false;
    updateSaveIssueButtonState();
    renderSelectedPhotos();
    saveDraft();
  } catch (error) {
    console.error("Could not convert selected photos to base64.", error);
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

  if (isProcessingPhotos) {
    const status = document.createElement("p");
    status.className = "muted";
    status.textContent = "Processing photo(s)...";
    selectedPhotoPreview.appendChild(status);
  } else if (photoConversionError) {
    const status = document.createElement("p");
    status.className = "muted";
    status.textContent = "Photo processing failed. Please try another photo.";
    selectedPhotoPreview.appendChild(status);
  } else if (selectedPhotos.length > 0) {
    const status = document.createElement("p");
    status.className = "muted";
    status.textContent = "Photos ready. Save Issue enabled.";
    selectedPhotoPreview.appendChild(status);
  }

  selectedPhotos.forEach(photo => {
    const img = document.createElement("img");
    img.src = photo;
    img.className = "photo-preview";
    selectedPhotoPreview.appendChild(img);
  });
}

async function saveIssue() {
  try {
    const observation = issueText.value.trim();

    if (!activeWalk) {
      alert("Start a plant walk first.");
      return;
    }

    if (!observation && selectedPhotos.length === 0) {
      alert("Enter an observation or attach a photo before saving.");
      return;
    }

    const issue = {
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString(),
      observation,
      photos: [...selectedPhotos]
    };

    activeWalk.issues.push(issue);

    await persistWalks();
    clearDraft();
    renderIssues();
  } catch (error) {
    console.error("saveIssue: error", error);
    alert(`Unable to save issue: ${error && error.message ? error.message : error}`);
  }
}

function convertPhotosToBase64(files, timeoutMs = 10000) {
  const fileList = Array.from(files || []);

  if (fileList.length === 0) {
    return Promise.resolve([]);
  }

  return Promise.all(
    fileList.map(file => {
      return new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          reject(new Error(`Photo processing timed out: ${file.name}`));
        }, timeoutMs);

        const reader = new FileReader();
        reader.onload = event => {
          window.clearTimeout(timeoutId);
          const dataUrl = event.target.result;
          if (typeof dataUrl !== "string") {
            reject(new Error(`Photo data was not available: ${file.name}`));
            return;
          }

          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const maxWidth = 900;
            const scale = Math.min(1, maxWidth / img.width);
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            const context = canvas.getContext("2d");

            if (!context) {
              reject(new Error(`Could not prepare photo canvas: ${file.name}`));
              return;
            }

            context.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.55));
          };
          img.onerror = () => reject(new Error(`Could not read photo: ${file.name}`));
          img.src = dataUrl;
        };
        reader.onerror = () => {
          window.clearTimeout(timeoutId);
          reject(new Error(`Could not read file: ${file.name}`));
        };
        reader.onabort = () => {
          window.clearTimeout(timeoutId);
          reject(new Error(`Photo read was cancelled: ${file.name}`));
        };
        reader.readAsDataURL(file);
      });
    })
  );
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
      <p><strong>Time:</strong> ${escapeHtml(issue.time)}</p>
      <p>${escapeHtml(issue.observation || "Photo-only issue")}</p>
      <p><strong>Photos:</strong> ${issue.photos.length}</p>
      <div class="photo-grid"></div>
    `;

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
    div.innerHTML = `
      <strong>Plant Walk</strong>
      <p><strong>Started:</strong> ${escapeHtml(walk.startedAt)}</p>
      <p><strong>Status:</strong> ${escapeHtml(walk.status || "completed")}</p>
      <p><strong>Total Issues:</strong> ${walk.issues.length}</p>
      <button data-id="${walk.id}">Generate Report</button>
    `;

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

Plant Walk Started: ${walk.startedAt}
Total Issues: ${walk.issues.length}

Raw observations:

`;

  walk.issues.forEach((issue, index) => {
    report += `Issue ${index + 1}
Time: ${issue.time}
Observation:
${issue.observation || "Photo-only issue"}
Photos: ${issue.photos.length > 0 ? "Yes - embedded in PDF report" : "No"}
--------------------------------

`;
  });

  return report;
}

function buildProfessionalReportHtml(walk) {
  let html = `
    <div class="report-header">
      <h1>Plant Walk Report</h1>
      <p><strong>Started:</strong> ${escapeHtml(walk.startedAt)}</p>
      <p><strong>Ended:</strong> ${escapeHtml(walk.endedAt || "Not completed")}</p>
      <p><strong>Total Issues:</strong> ${walk.issues.length}</p>
      <p><strong>App Version:</strong> ${escapeHtml(walk.version || APP_VERSION)}</p>
    </div>

    <section class="report-section">
      <h2>Executive Summary</h2>
      <p>This report documents ${walk.issues.length} maintenance and reliability observation${walk.issues.length === 1 ? "" : "s"} captured during the plant walk.</p>
    </section>

    <section class="report-section">
      <h2>Recorded Issues</h2>
  `;

  walk.issues.forEach((issue, index) => {
    html += `
      <div class="report-issue">
        <h3>Issue ${index + 1}</h3>
        <p><strong>Time:</strong> ${escapeHtml(issue.time)}</p>
        <p><strong>Observation:</strong></p>
        <p>${escapeHtml(issue.observation || "Photo-only issue")}</p>
        <p><strong>Photos:</strong> ${issue.photos.length}</p>
        <div class="report-photo-grid">
    `;

    issue.photos.forEach(photo => {
      html += `<img class="report-photo" src="${photo}" alt="Issue photo" />`;
    });

    html += `
        </div>
      </div>
    `;
  });

  html += `
    </section>

    <section class="report-section">
      <h2>Maintenance Review Areas</h2>
      <p><strong>Safety Concerns:</strong> Review observations for damaged guarding, exposed electrical conditions, trip hazards, and unsafe operating conditions.</p>
      <p><strong>Immediate Repairs:</strong> Prioritize items affecting safety, production uptime, equipment protection, or compliance.</p>
      <p><strong>Suggested Work Orders:</strong> Convert validated findings into corrective work orders with equipment, priority, assigned craft, and target completion date.</p>
      <p><strong>Reliability Concerns:</strong> Review repeated failures, noisy bearings, damaged sensors, loose wiring, worn conveyors, and poor accessibility.</p>
      <p><strong>Engineering Improvements:</strong> Consider guarding, cable management, sensor protection, PM updates, and design changes to prevent recurrence.</p>
    </section>
  `;

  return html;
}

function copyReport() {
  reportOutput.select();
  document.execCommand("copy");
  alert("Report copied.");
}

function focusObservationField() {
  issueText.focus({ preventScroll: false });
  issueText.scrollIntoView({ behavior: "smooth", block: "center" });

  const length = issueText.value.length;
  issueText.setSelectionRange(length, length);
}

function toggleVoiceDictation() {
  focusObservationField();

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
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
