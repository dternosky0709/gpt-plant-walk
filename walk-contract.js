(function (global) {
  "use strict";

  const SCHEMA_VERSION = "1.0";

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return Object.prototype.toString.call(value) === "[object Object]" &&
      (prototype === null || (prototype.constructor && prototype.constructor.name === "Object"));
  }

  function requireObject(value, label) {
    if (!isPlainObject(value)) throw new TypeError(`${label} must be a plain object.`);
  }

  function requireString(value, label) {
    if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label} is required.`);
    return value;
  }

  function optionalString(value, label) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label} must be a non-empty string when provided.`);
    return value;
  }

  function firstAvailable(source, names) {
    for (const name of names) {
      if (source[name] !== undefined && source[name] !== null && source[name] !== "") return source[name];
    }
    return null;
  }

  function mediaTypeFromReference(reference) {
    const match = /^data:([^;,]+)[;,]/i.exec(reference);
    return match ? match[1].toLowerCase() : null;
  }

  function validatePhotoReference(reference, label) {
    requireString(reference, `${label} reference`);
    if (!/^(data:image\/[a-z0-9.+-]+(?:;[^,]*)?,|blob:|https?:\/\/|\.\.?\/|\/)/i.test(reference)) {
      throw new TypeError(`${label} uses an unsupported photo reference.`);
    }
    return reference;
  }

  function normalizePhoto(photo, index, issueLabel) {
    const label = `${issueLabel} photo ${index + 1}`;
    if (typeof photo === "string") {
      const reference = validatePhotoReference(photo, label);
      return Object.freeze({
        id: null,
        reference,
        mediaType: mediaTypeFromReference(reference),
        name: null,
        capturedAt: null
      });
    }

    requireObject(photo, label);
    const reference = validatePhotoReference(firstAvailable(photo, ["reference", "dataUrl", "url"]), label);
    const mediaType = optionalString(photo.mediaType, `${label} mediaType`) || mediaTypeFromReference(reference);
    if (mediaType && !/^image\/[a-z0-9.+-]+$/i.test(mediaType)) {
      throw new TypeError(`${label} mediaType must describe an image.`);
    }
    return Object.freeze({
      id: optionalString(photo.id, `${label} id`),
      reference,
      mediaType,
      name: optionalString(photo.name, `${label} name`),
      capturedAt: optionalString(photo.capturedAt, `${label} capturedAt`)
    });
  }

  function normalizeWalkForAi(walk) {
    requireObject(walk, "Walk");
    const walkId = requireString(firstAvailable(walk, ["id", "walkId"]), "Walk id");
    if (!Array.isArray(walk.issues)) throw new TypeError("Walk issues must be an array.");
    if (walk.issues.length === 0) throw new TypeError("Walk must include at least one issue.");

    const seenIssueIds = new Set();
    const issues = walk.issues.map((issue, index) => {
      const label = `Issue ${index + 1}`;
      requireObject(issue, label);
      const issueId = requireString(firstAvailable(issue, ["id", "issueId"]), `${label} id`);
      if (seenIssueIds.has(issueId)) throw new TypeError(`Duplicate issue id: ${issueId}.`);
      seenIssueIds.add(issueId);

      const suppliedOrder = firstAvailable(issue, ["order", "sequence"]);
      if (suppliedOrder !== null && (!Number.isInteger(suppliedOrder) || suppliedOrder !== index + 1)) {
        throw new TypeError(`${label} has invalid issue ordering.`);
      }
      if (typeof issue.observation !== "string" || !issue.observation.trim()) {
        throw new TypeError(`${label} observation is required and cannot be blank.`);
      }
      if (issue.photos !== undefined && !Array.isArray(issue.photos)) {
        throw new TypeError(`${label} photos must be an array.`);
      }

      const photos = (issue.photos || []).map((photo, photoIndex) => normalizePhoto(photo, photoIndex, label));
      return Object.freeze({
        issueId,
        order: index + 1,
        observedAt: optionalString(firstAvailable(issue, ["observedAt", "timestamp", "time"]), `${label} timestamp`),
        workOrderNumber: optionalString(firstAvailable(issue, ["workOrderNumber", "workOrderId"]), `${label} work-order number`),
        observation: issue.observation,
        photos: Object.freeze(photos)
      });
    });

    return Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      walkId,
      createdAt: optionalString(firstAvailable(walk, ["createdAt", "startedAt"]), "Walk created timestamp"),
      completedAt: optionalString(firstAvailable(walk, ["completedAt", "endedAt"]), "Walk completed timestamp"),
      site: optionalString(firstAvailable(walk, ["site", "plant", "plantName"]), "Walk site"),
      inspector: optionalString(walk.inspector, "Walk inspector"),
      issues: Object.freeze(issues)
    });
  }

  global.walkContract = Object.freeze({ SCHEMA_VERSION, normalizeWalkForAi });
})(typeof globalThis !== "undefined" ? globalThis : window);
