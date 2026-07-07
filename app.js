const STORAGE_KEY = "gptPlantWalks";
const DRAFT_KEY = "gptPlantWalkDraft";

let walks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let activeWalk = null;
let recognition = null;
let isListening = false;
let selectedPhotos = [];

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

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

restoreDraft();

function persistWalks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(walks));
}

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, issueText.value);
}

function restoreDraft() {
  const draft = localStorage.getItem(DRAFT_KEY);
  if (draft) issueText.value = draft;
}

function clearDraft() {
  issueText.value = "";
  photoInput.value = "";
  selectedPhotos = [];
  selectedPhotoPreview.innerHTML = "";
  localStorage.removeItem(DRAFT_KEY);
}

function startWalk() {
  activeWalk = {
    id: crypto.randomUUID(),
    startedAt: new Date().toLocaleString(),
    issues: []
  };

  walks.unshift(activeWalk);
  persistWalks();

  activeWalkSection.classList.remove("hidden");
  previousWalksSection.classList.add("hidden");
  reportSection.classList.add("hidden");

  walkStartedText.textContent = `Started: ${activeWalk.startedAt}`;
  renderIssues();
}

async function handleSelectedPhotos() {
  selectedPhotos = await convertPhotosToBase64(photoInput.files);
  selectedPhotoPreview.innerHTML = "";

  selectedPhotos.forEach(photo => {
    const img = document.createElement("img");
    img.src = photo;
    img.className = "photo-preview";
    selectedPhotoPreview.appendChild(img);
  });
}

async function saveIssue() {
  const observation = issueText.value.trim();

  if (!activeWalk) {
    alert("Start a plant walk first.");
    return;
  }

  if (!observation) {
    alert("Enter an observation before saving.");
    return;
  }

  activeWalk.issues.push({
    id: crypto.randomUUID(),
    time: new Date().toLocaleTimeString(),
    observation,
    photos: selectedPhotos
  });

  persistWalks();
  clearDraft();
  renderIssues();
}

function convertPhotosToBase64(files) {
  return Promise.all(
    Array.from(files).map(file => {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
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
      <p>${escapeHtml(issue.observation)}</p>
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
      <p><strong>Total Issues:</strong> ${walk.issues.length}</p>
      <button data-id="${walk.id}">Generate Report</button>
    `;

    div.querySelector("button").addEventListener("click", () => generateReport(walk.id));
    walkList.appendChild(div);
  });
}

function finishWalk() {
  if (!activeWalk) return;
  generateReport(activeWalk.id);
  activeWalk = null;
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
${issue.observation}
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
      <p><strong>Total Issues:</strong> ${walk.issues.length}</p>
    </div>

    <section class="report-section">
      <h2>Executive Summary</h2>
      <p>This report documents maintenance and reliability observations captured during the plant walk.</p>
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
        <p>${escapeHtml(issue.observation)}</p>
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
