const STORAGE_KEY = "gptPlantWalks";
const DRAFT_KEY = "gptPlantWalkDraft";
const MAX_IMAGE_WIDTH = 1400;
const IMAGE_QUALITY = 0.72;

let walks = safeLoadWalks();
let activeWalk = null;
let recognition = null;
let isListening = false;
let selectedPhotos = [];
let photosAreProcessing = false;

const startWalkBtn = document.getElementById("startWalkBtn");
const viewWalksBtn = document.getElementById("viewWalksBtn");
const activeWalkSection = document.getElementById("activeWalkSection");
const previousWalksSection = document.getElementById("previousWalksSection");
const reportSection = document.getElementById("reportSection");
const walkStartedText = document.getElementById("walkStartedText");
const issueCountBadge = document.getElementById("issueCountBadge");
const issueText = document.getElementById("issueText");
const photoInput = document.getElementById("photoInput");
const photoStatus = document.getElementById("photoStatus");
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
updatePhotoStatus();

function safeLoadWalks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (error) {
    console.error("Unable to load saved walks.", error);
    return [];
  }
}

function persistWalks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(walks));
  } catch (error) {
    alert("The walk could not be saved. The most common cause is photos that are too large. Try deleting older walks or use fewer photos.");
    console.error("Unable to save walks.", error);
  }
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
  updatePhotoStatus();
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
  const files = Array.from(photoInput.files || []);
  selectedPhotos = [];
  selectedPhotoPreview.innerHTML = "";

  if (files.length === 0) {
    updatePhotoStatus();
    return;
  }

  photosAreProcessing = true;
  saveIssueBtn.disabled = true;
  photoStatus.textContent = `Processing ${files.length} ${files.length === 1 ? "photo" : "photos"}...`;

  try {
    selectedPhotos = await Promise.all(files.map(fileToCompressedDataUrl));
    renderSelectedPhotoPreview();
  } catch (error) {
    selectedPhotos = [];
    selectedPhotoPreview.innerHTML = "";
    alert("One or more photos could not be loaded. Please try again.");
    console.error("Photo processing failed.", error);
  } finally {
    photosAreProcessing = false;
    saveIssueBtn.disabled = false;
    updatePhotoStatus();
  }
}

function renderSelectedPhotoPreview() {
  selectedPhotoPreview.innerHTML = "";

  selectedPhotos.forEach((photo, index) => {
    const wrapper = document.createElement("figure");
    wrapper.className = "photo-card";

    const img = document.createElement("img");
    img.src = photo;
    img.className = "photo-preview";
    img.alt = `Selected issue photo ${index + 1}`;

    const caption = document.createElement("figcaption");
    caption.textContent = `Photo ${index + 1}`;

    wrapper.appendChild(img);
    wrapper.appendChild(caption);
    selectedPhotoPreview.appendChild(wrapper);
  });
}

function updatePhotoStatus() {
  if (photosAreProcessing) return;

  if (selectedPhotos.length === 0) {
    photoStatus.textContent = "No photos selected.";
    return;
  }

  photoStatus.textContent = `${selectedPhotos.length} ${selectedPhotos.length === 1 ? "photo is" : "photos are"} ready and will be saved with this issue.`;
}

function fileToCompressedDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();

      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_WIDTH / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL("image/jpeg", IMAGE_QUALITY));
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

async function saveIssue() {
  const observation = issueText.value.trim();

  if (!activeWalk) {
    alert("Start a plant walk first.");
    return;
  }

  if (photosAreProcessing) {
    alert("Photos are still processing. Wait for the photo-ready message, then save the issue.");
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
    photos: [...selectedPhotos]
  });

  persistWalks();
  clearDraft();
  renderIssues();
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
      <p><strong>Photos:</strong> ${(issue.photos || []).length}</p>
      <div class="photo-grid"></div>
    `;

    const grid = div.querySelector(".photo-grid");
    (issue.photos || []).forEach((photo, photoIndex) => {
      const wrapper = document.createElement("figure");
      wrapper.className = "photo-card";

      const img = document.createElement("img");
      img.src = photo;
      img.className = "photo-preview";
      img.alt = `Saved issue ${index + 1} photo ${photoIndex + 1}`;

      const caption = document.createElement("figcaption");
      caption.textContent = `Photo ${photoIndex + 1}`;

      wrapper.appendChild(img);
      wrapper.appendChild(caption);
      grid.appendChild(wrapper);
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
    const photoCount = walk.issues.reduce((total, issue) => total + ((issue.photos || []).length), 0);
    const div = document.createElement("div");
    div.className = "walk";
    div.innerHTML = `
      <strong>Plant Walk</strong>
      <p><strong>Started:</strong> ${escapeHtml(walk.startedAt)}</p>
      <p><strong>Total Issues:</strong> ${walk.issues.length}</p>
      <p><strong>Total Photos:</strong> ${photoCount}</p>
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
    const photoCount = (issue.photos || []).length;
    report += `Issue ${index + 1}
Time: ${issue.time}
Observation:
${issue.observation}
Photos: ${photoCount > 0 ? `Yes - ${photoCount} embedded in PDF report` : "No"}
--------------------------------

`;
  });

  return report;
}

function buildProfessionalReportHtml(walk) {
  const totalPhotos = walk.issues.reduce((total, issue) => total + ((issue.photos || []).length), 0);

  let html = `
    <div class="report-header">
      <h1>Plant Walk Report</h1>
      <p><strong>Started:</strong> ${escapeHtml(walk.startedAt)}</p>
      <p><strong>Total Issues:</strong> ${walk.issues.length}</p>
      <p><strong>Total Photos:</strong> ${totalPhotos}</p>
    </div>

    <section class="report-section">
      <h2>Executive Summary</h2>
      <p>This report documents maintenance and reliability observations captured during the plant walk, including field photos when provided.</p>
    </section>

    <section class="report-section">
      <h2>Recorded Issues</h2>
  `;

  walk.issues.forEach((issue, index) => {
    const photos = issue.photos || [];
    html += `
      <div class="report-issue">
        <h3>Issue ${index + 1}</h3>
        <p><strong>Time:</strong> ${escapeHtml(issue.time)}</p>
        <p><strong>Observation:</strong></p>
        <p>${escapeHtml(issue.observation)}</p>
        <p><strong>Photos:</strong> ${photos.length}</p>
    `;

    if (photos.length > 0) {
      html += `<div class="report-photo-grid">`;
      photos.forEach((photo, photoIndex) => {
        html += `
          <figure class="report-photo-card">
            <img class="report-photo" src="${photo}" alt="Issue ${index + 1} photo ${photoIndex + 1}" />
            <figcaption>Issue ${index + 1} - Photo ${photoIndex + 1}</figcaption>
          </figure>
        `;
      });
      html += `</div>`;
    } else {
      html += `<p class="muted">No photos were saved with this issue.</p>`;
    }

    html += `</div>`;
  });

  html += `
    </section>

    <section class="report-section">
      <h2>Maintenance Review Areas</h2>
      <p><strong>Safety Concerns:</strong> Review observations for damaged guarding, exposed electrical conditions, trip hazards, and unsafe operating conditions.</p>
      <p><strong>Immediate Repairs:</strong> Prioritize items affecting safety, production uptime, equipment protection, or compliance.</p>
      <p><strong>Reliability Concerns:</strong> Review repeated failures, noisy bearings, damaged sensors, loose wiring, worn conveyors, poor accessibility, and recurring stoppages.</p>
      <p><strong>Engineering Improvements:</strong> Consider guarding, cable management, sensor protection, end effector improvements, PM updates, and design changes to prevent recurrence.</p>
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
