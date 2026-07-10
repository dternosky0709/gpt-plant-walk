const SETTINGS_KEY = "gptPlantWalkSettings";
const SETTINGS_APP_VERSION = "v0.8.1-alpha2";

const defaultSettings = {
  companyName: "",
  plantName: "",
  companyLogo: "",
  workOrderFormat: "WO-{DATE}-{SEQ}",
  workOrderTemplate: "WO-{DATE}-{SEQ}",
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
const companyLogoInput = document.getElementById("companyLogoInput");
const logoPreviewCard = document.getElementById("logoPreviewCard");
const companyLogoPreview = document.getElementById("companyLogoPreview");
const removeLogoBtn = document.getElementById("removeLogoBtn");
const workOrderFormatInput = document.getElementById("workOrderFormatInput");
const customFormatBuilder = document.getElementById("customFormatBuilder");
const sequenceStartInput = document.getElementById("sequenceStartInput");
const sequenceDigitsInput = document.getElementById("sequenceDigitsInput");
const workOrderPreview = document.getElementById("workOrderPreview");
const settingsSavedMessage = document.getElementById("settingsSavedMessage");

let pendingLogo = "";
let appSettings = loadSettings();
applySettings(appSettings);
populateSettingsForm(appSettings);
updateWorkOrderPreview();

settingsBtn.addEventListener("click", openSettings);
closeSettingsBtn.addEventListener("click", closeSettings);
settingsForm.addEventListener("submit", saveSettings);
companyLogoInput.addEventListener("change", handleLogoUpload);
removeLogoBtn.addEventListener("click", removeLogo);
workOrderFormatInput.addEventListener("input", updateWorkOrderPreview);
sequenceStartInput.addEventListener("input", updateWorkOrderPreview);
sequenceDigitsInput.addEventListener("change", updateWorkOrderPreview);

document.querySelectorAll('input[name="workOrderTemplate"]').forEach(input => {
  input.addEventListener("change", handleTemplateChange);
});

document.querySelectorAll(".token-button").forEach(button => {
  button.addEventListener("click", handleTokenButton);
});

document.querySelectorAll('input[name="theme"]').forEach(input => {
  input.addEventListener("change", () => applyTheme(input.value));
});

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    const merged = { ...defaultSettings, ...(saved || {}) };

    if (merged.plantCode && merged.workOrderFormat.includes("{PLANT}")) {
      merged.workOrderFormat = merged.workOrderFormat.replaceAll("{PLANT}", sanitizeText(merged.plantCode));
    }

    if (!merged.workOrderTemplate) {
      merged.workOrderTemplate = getMatchingTemplate(merged.workOrderFormat);
    }

    delete merged.plantCode;
    return merged;
  } catch (error) {
    console.error("Could not load settings.", error);
    return { ...defaultSettings };
  }
}

function populateSettingsForm(settings) {
  companyNameInput.value = settings.companyName || "";
  plantNameInput.value = settings.plantName || "";
  pendingLogo = settings.companyLogo || "";
  renderLogoPreview();

  const templateValue = getMatchingTemplate(settings.workOrderFormat || defaultSettings.workOrderFormat);
  const templateInput = document.querySelector(`input[name="workOrderTemplate"][value="${cssEscape(templateValue)}"]`);
  const customInput = document.querySelector('input[name="workOrderTemplate"][value="custom"]');

  if (templateInput) templateInput.checked = true;
  else if (customInput) customInput.checked = true;

  workOrderFormatInput.value = settings.workOrderFormat || defaultSettings.workOrderFormat;
  customFormatBuilder.classList.toggle("hidden", templateValue !== "custom");
  sequenceStartInput.value = Number(settings.sequenceStart) || 1;
  sequenceDigitsInput.value = String(Number(settings.sequenceDigits) || 3);

  const themeInput = document.querySelector(`input[name="theme"][value="${settings.theme}"]`);
  if (themeInput) themeInput.checked = true;
}

function openSettings() {
  dashboardSection.classList.add("hidden");
  settingsSection.classList.remove("hidden");
  settingsSavedMessage.classList.add("hidden");
  populateSettingsForm(appSettings);
  updateWorkOrderPreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeSettings() {
  settingsSection.classList.add("hidden");
  dashboardSection.classList.remove("hidden");
  applyTheme(appSettings.theme || "light");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function handleTemplateChange(event) {
  const value = event.target.value;
  const isCustom = value === "custom";
  customFormatBuilder.classList.toggle("hidden", !isCustom);

  if (!isCustom) {
    workOrderFormatInput.value = value;
  } else if (!workOrderFormatInput.value.trim()) {
    workOrderFormatInput.value = defaultSettings.workOrderFormat;
  }

  updateWorkOrderPreview();
}

function handleTokenButton(event) {
  const button = event.currentTarget;
  if (button.dataset.action === "clear") {
    workOrderFormatInput.value = "";
    workOrderFormatInput.focus();
    updateWorkOrderPreview();
    return;
  }

  insertAtCursor(workOrderFormatInput, button.dataset.token || "");
  updateWorkOrderPreview();
}

function insertAtCursor(input, text) {
  const start = Number.isInteger(input.selectionStart) ? input.selectionStart : input.value.length;
  const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : input.value.length;
  input.value = `${input.value.slice(0, start)}${text}${input.value.slice(end)}`;
  const nextPosition = start + text.length;
  input.focus();
  input.setSelectionRange(nextPosition, nextPosition);
}

async function handleLogoUpload() {
  const file = companyLogoInput.files && companyLogoInput.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Please choose an image file for the company logo.");
    companyLogoInput.value = "";
    return;
  }

  if (file.size > 4 * 1024 * 1024) {
    alert("Please choose a logo smaller than 4 MB.");
    companyLogoInput.value = "";
    return;
  }

  try {
    pendingLogo = await resizeLogo(file, 600, 240);
    renderLogoPreview();
  } catch (error) {
    console.error("Could not process company logo.", error);
    alert("The company logo could not be processed. Please try another image.");
  }
}

function resizeLogo(file, maxWidth, maxHeight) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Canvas is unavailable."));
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Image could not be loaded."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("File could not be read."));
    reader.readAsDataURL(file);
  });
}

function removeLogo() {
  pendingLogo = "";
  companyLogoInput.value = "";
  renderLogoPreview();
}

function renderLogoPreview() {
  if (pendingLogo) {
    companyLogoPreview.src = pendingLogo;
    logoPreviewCard.classList.remove("hidden");
  } else {
    companyLogoPreview.removeAttribute("src");
    logoPreviewCard.classList.add("hidden");
  }
}

function saveSettings(event) {
  event.preventDefault();

  const selectedTheme = document.querySelector('input[name="theme"]:checked');
  const selectedTemplate = document.querySelector('input[name="workOrderTemplate"]:checked');
  const format = getActiveFormat().trim().toUpperCase();

  if (!format.includes("{SEQ}")) {
    alert("The work order number must include Sequence so every work order is unique.");
    if (selectedTemplate && selectedTemplate.value !== "custom") {
      document.querySelector('input[name="workOrderTemplate"][value="custom"]').checked = true;
      customFormatBuilder.classList.remove("hidden");
    }
    workOrderFormatInput.focus();
    return;
  }

  appSettings = {
    companyName: companyNameInput.value.trim(),
    plantName: plantNameInput.value.trim(),
    companyLogo: pendingLogo,
    workOrderFormat: format,
    workOrderTemplate: selectedTemplate ? selectedTemplate.value : "custom",
    sequenceStart: Math.max(1, Number(sequenceStartInput.value) || 1),
    sequenceDigits: Number(sequenceDigitsInput.value) || 3,
    theme: selectedTheme ? selectedTheme.value : "light"
  };

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings));
  } catch (error) {
    console.error("Could not save settings.", error);
    alert("Settings could not be saved. Try using a smaller company logo.");
    return;
  }

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

function getActiveFormat() {
  const selectedTemplate = document.querySelector('input[name="workOrderTemplate"]:checked');
  if (!selectedTemplate || selectedTemplate.value === "custom") {
    return workOrderFormatInput.value || defaultSettings.workOrderFormat;
  }
  return selectedTemplate.value;
}

function updateWorkOrderPreview() {
  const previewSettings = {
    companyName: companyNameInput.value.trim(),
    workOrderFormat: getActiveFormat(),
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
  const company = sanitizeText(settings.companyName) || "COMPANY";

  return (settings.workOrderFormat || defaultSettings.workOrderFormat)
    .replaceAll("{COMPANY}", company)
    .replaceAll("{DATE}", `${year}${month}${day}`)
    .replaceAll("{YEAR}", year)
    .replaceAll("{MONTH}", month)
    .replaceAll("{DAY}", day)
    .replaceAll("{SEQ}", sequenceValue)
    .toUpperCase();
}

function getMatchingTemplate(format) {
  const templates = ["WO-{DATE}-{SEQ}", "WO-{YEAR}-{SEQ}", "WO-{SEQ}", "{DATE}-{SEQ}"];
  return templates.includes(format) ? format : "custom";
}

function sanitizeText(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_-]/g, "");
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
  return String(value).replace(/(["'\\])/g, "\\$1");
}
