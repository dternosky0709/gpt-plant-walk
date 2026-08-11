(function (global) {
  "use strict";

  const CONTRACT_VERSION = "1.0";
  const SYNC_ENDPOINT = "/api/sync-maintenance-planner";
  const RETRY_DELAYS_MS = [30000, 120000, 300000, 900000, 3600000];

  function createId(prefix) {
    const value = global.crypto && typeof global.crypto.randomUUID === "function"
      ? global.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    return `${prefix}-${value}`;
  }

  function uniqueSuffix(value) {
    const normalized = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalized.length >= 12) return normalized.slice(0, 12);
    let hash = 2166136261;
    for (let index = 0; index < normalized.length; index += 1) {
      hash ^= normalized.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${normalized}${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}${normalized}`.slice(0, 12).padEnd(12, "0");
  }

  function ensureGlobalWorkOrderId(baseWorkOrderId, observationId) {
    const base = requireText(baseWorkOrderId, "Work-order id").replace(/[^A-Za-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "");
    const suffix = uniqueSuffix(requireText(observationId, "Observation id"));
    if (base.toUpperCase().endsWith(`-${suffix}`)) return base;
    return `${base.slice(0, 115)}-${suffix}`;
  }

  function displayWorkOrderId(workOrderId) {
    const value = String(workOrderId || "").trim();
    return value.replace(/-([A-Z0-9]{12})$/i, "");
  }

  function requireText(value, label) {
    if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label} is required.`);
    return value.trim();
  }

  function titleFromObservation(observation) {
    const text = String(observation || "").trim();
    if (!text) return "Photo-only Plant Walk observation";
    const firstLine = text.split(/\r?\n/)[0].trim();
    return firstLine.length <= 240 ? firstLine : `${firstLine.slice(0, 237).trimEnd()}...`;
  }

  function buildIntakePayload({ walk, issue, plantName = "", deployment = "production", eventId = null, sentAt = null }) {
    if (!walk || typeof walk !== "object") throw new TypeError("Walk is required.");
    if (!issue || typeof issue !== "object") throw new TypeError("Issue is required.");
    const walkId = requireText(walk.id, "Walk id");
    const observationId = requireText(issue.id, "Observation id");
    const workOrderId = requireText(issue.workOrderId, "Work-order id");
    const observation = String(issue.observation || "");
    const observedAt = requireText(issue.observedAt, "Observation timestamp");
    const photos = Array.isArray(issue.photos) ? issue.photos : [];
    const normalizedPlantId = String(plantName || "").toUpperCase().replace(/[^A-Z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 128);

    return {
      contractVersion: CONTRACT_VERSION,
      eventId: eventId || createId("evt"),
      sentAt: sentAt || new Date().toISOString(),
      source: {
        application: "plant-walk",
        deployment,
        ...(normalizedPlantId ? { plantId: normalizedPlantId } : {}),
        plantWalkId: walkId,
        observationId
      },
      workOrder: {
        id: workOrderId,
        title: titleFromObservation(observation),
        initialPriority: issue.initialPriority || "Planned"
      },
      observation: {
        text: observation || "Photo-only observation; field verification required.",
        observedAt,
        photoReferences: photos.slice(0, 12).map((photo, index) => ({ photoId: `photo-${observationId}-${index + 1}` }))
      }
    };
  }

  function nextRetryAt(attemptCount, now = Date.now()) {
    const index = Math.min(Math.max(0, Number(attemptCount) - 1), RETRY_DELAYS_MS.length - 1);
    return new Date(now + RETRY_DELAYS_MS[index]).toISOString();
  }

  function summarizeWalkSync(walk) {
    const issues = walk && Array.isArray(walk.issues) ? walk.issues : [];
    const summary = { total: issues.length, synced: 0, pending: 0, failed: 0, notQueued: 0 };
    issues.forEach(issue => {
      if (issue.syncStatus === "synced") summary.synced += 1;
      else if (issue.syncStatus === "sync_failed") summary.failed += 1;
      else if (issue.syncStatus === "pending_sync") summary.pending += 1;
      else summary.notQueued += 1;
    });
    return summary;
  }

  global.plannerSync = Object.freeze({ CONTRACT_VERSION, SYNC_ENDPOINT, buildIntakePayload, displayWorkOrderId, ensureGlobalWorkOrderId, nextRetryAt, summarizeWalkSync, titleFromObservation });
})(typeof globalThis !== "undefined" ? globalThis : window);
