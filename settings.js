const SETTINGS_KEY = "gptPlantWalkSettings";
const SETTINGS_APP_VERSION = "v0.8.0-alpha1";

const defaultSettings = {
  companyName: "",
  plantName: "",
  plantCode: "PW",
  workOrderFormat: "PW-{DATE}-{SEQ}",
  sequenceStart: 1,
  sequenceDigits: 3,
  theme: "light"
};

const settingsBtn = document.getElementById("settingsBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const settingsSection = document.getElementById("settingsSection");
const dashboardSection = document.getElementById("dashboardSection");
const settingsForm = document.getElementById("settingsForm");
const companyNameInput = document.getElementById("companyNameInput");
const plantNameInput = document.getElementById("plantNameInput");
const plantCodeInput = document.getElementById("plantCodeInput");
const workOrderFormatInput = document.getElementById("workOrderFormatInput");
const sequenceStartInput = document.getElementById("sequenceStartInput");
const sequenceDigitsInput = document.getElementById("sequenceDigitsInput");
const workOrderPreview = document.getElementById("workOrderPreview");
const settingsSavedMessage = document.getElementById("settingsSavedMessage");
const visibleAppVersion = document.getElementById("appVersionText");

if (visibleAppVersion) visibleAppVersion.textContent = `GPT Plant Walk ${SETTINGS_APP_VERSION}`;

let appSettings = loadSettings();
applySettings(appSettings);
populateSettingsForm(appSettings);
updateWorkOrderPreview();

settingsBtn.addEventListener("click", openSettings);
closeSettingsBtn.addEventListener("click", closeSettings);
settingsForm.addEventListener("submit", saveSettings);

[plantCodeInput, workOrderFormatInput, sequenceStartInput, sequenceDigitsInput].forEach(element => {
  element.addEventListener("input", updateWorkOrderPreview);
  element.addEventListener("change", updateWorkOrderPreview);
});

document.querySelectorAll('input[name="theme"]').forEach(input => {
  input.addEventListener("change", () => applyTheme(input.value));
});

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return { ...defaultSettings, ...(saved || {}) };
  } catch (error) {
    console.error("Could not load settings.", error);
    return { ...defaultSettings };
  }
}

function populateSettingsForm(settings) {
  companyNameInput.value = settings.companyName || "";
  plantNameInput.value = settings.plantName || "";
  plantCodeInput.value = settings.plantCode || "PW";
  workOrderFormatInput.value = settings.workOrderFormat || defaultSettings.workOrderFormat;
  sequenceStartInput.value = Number(settings.sequenceStart) || 1;
  sequenceDigitsInput.value = String(Number(settings.sequenceDigits) || 3);

  const themeInput = document.querySelector(`input[name="theme"][value="${settings.theme}"]`);
  if (themeInput) themeInput.checked = true;
}

function openSettings() {
  dashboardSection.classList.add("hidden");
  settingsSection.classList.remove("hidden");
  settingsSavedMessage.classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeSettings() {
  settingsSection.classList.add("hidden");
  dashboardSection.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function saveSettings(event) {
  event.preventDefault();

  const selectedTheme = document.querySelector('input[name="theme"]:checked');
  const format = workOrderFormatInput.value.trim() || defaultSettings.workOrderFormat;

  if (!format.includes("{SEQ}")) {
    alert("The work order format must include {SEQ} so each number is unique.");
    workOrderFormatInput.focus();
    return;
  }

  appSettings = {
    companyName: companyNameInput.value.trim(),
    plantName: plantNameInput.value.trim(),
    plantCode: sanitizeCode(plantCodeInput.value) || "PW",
    workOrderFormat: format.toUpperCase(),
    sequenceStart: Math.max(1, Number(sequenceStartInput.value) || 1),
    sequenceDigits: Number(sequenceDigitsInput.value) || 3,
    theme: selectedTheme ? selectedTheme.value : "light"
  };

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings));
  applySettings(appSettings);
  populateSettingsForm(appSettings);
  updateWorkOrderPreview();
  settingsSavedMessage.classList.remove("hidden");

  window.setTimeout(() => settingsSavedMessage.classList.add("hidden"), 2200);
}

function applySettings(settings) {
  applyTheme(settings.theme || "light");
  window.gptPlantWalkSettings = settings;
  window.generateWorkOrderNumber = generateWorkOrderNumber;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
  const themeColor = theme === "dark" ? "#101713" : "#173826";
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute("content", themeColor);
}

function updateWorkOrderPreview() {
  const previewSettings = {
    plantCode: sanitizeCode(plantCodeInput.value) || "PW",
    workOrderFormat: workOrderFormatInput.value.trim() || defaultSettings.workOrderFormat,
    sequenceStart: Math.max(1, Number(sequenceStartInput.value) || 1),
    sequenceDigits: Number(sequenceDigitsInput.value) || 3
  };

  workOrderPreview.textContent = generateWorkOrderNumber(previewSettings.sequenceStart, new Date(), previewSettings);
}

function generateWorkOrderNumber(sequence, date = new Date(), settings = appSettings) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const digits = Number(settings.sequenceDigits) || 3;
  const sequenceValue = String(sequence).padStart(digits, "0");
  const plant = sanitizeCode(settings.plantCode) || "PW";

  return (settings.workOrderFormat || defaultSettings.workOrderFormat)
    .replaceAll("{PLANT}", plant)
    .replaceAll("{DATE}", `${year}${month}${day}`)
    .replaceAll("{YEAR}", year)
    .replaceAll("{MONTH}", month)
    .replaceAll("{DAY}", day)
    .replaceAll("{SEQ}", sequenceValue)
    .toUpperCase();
}

function sanitizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
}
