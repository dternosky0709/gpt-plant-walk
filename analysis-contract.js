(function (global) {
  "use strict";

  const SCHEMA_VERSION = "1.0";
  const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
  const ALLOWED_KEYS = new Set(["schemaVersion", "walkId", "provider", "model", "status", "summary", "issues"]);
  const ISSUE_KEYS = new Set(["issueId", "order", "priority", "trade", "recommendation"]);

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return Object.prototype.toString.call(value) === "[object Object]" &&
      (prototype === null || (prototype.constructor && prototype.constructor.name === "Object"));
  }

  function assertKeys(value, allowed, label) {
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) throw new TypeError(`${label} contains unsupported field: ${key}.`);
    }
  }

  function requireString(value, label) {
    if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label} is required.`);
    return value;
  }

  function validateAnalysisResult(value, expected) {
    if (!isPlainObject(value)) throw new TypeError("AI provider must return a plain analysis object.");
    assertKeys(value, ALLOWED_KEYS, "AI analysis");
    if (value.schemaVersion !== SCHEMA_VERSION) throw new TypeError("AI analysis has an unsupported schemaVersion.");
    requireString(value.walkId, "AI analysis walkId");
    requireString(value.provider, "AI analysis provider");
    requireString(value.model, "AI analysis model");
    requireString(value.status, "AI analysis status");
    requireString(value.summary, "AI analysis summary");
    if (value.status !== "completed") throw new TypeError("AI analysis status must be completed.");
    if (value.walkId !== expected.walkId) throw new Error("AI analysis walkId must match the requested walk.");
    if (!Array.isArray(value.issues) || value.issues.length !== expected.issueIds.length) {
      throw new TypeError("AI analysis issues must match the requested issue count.");
    }

    const issues = value.issues.map((issue, index) => {
      if (!isPlainObject(issue)) throw new TypeError(`AI analysis issue ${index + 1} must be a plain object.`);
      assertKeys(issue, ISSUE_KEYS, `AI analysis issue ${index + 1}`);
      if (issue.issueId !== expected.issueIds[index]) throw new Error(`AI analysis issue ${index + 1} must preserve requested issue order and identity.`);
      if (issue.order !== index + 1) throw new TypeError(`AI analysis issue ${index + 1} has invalid ordering.`);
      if (!PRIORITIES.has(issue.priority)) throw new TypeError(`AI analysis issue ${index + 1} has an invalid priority.`);
      requireString(issue.trade, `AI analysis issue ${index + 1} trade`);
      requireString(issue.recommendation, `AI analysis issue ${index + 1} recommendation`);
      return Object.freeze({ ...issue });
    });

    return Object.freeze({ ...value, issues: Object.freeze(issues) });
  }

  global.analysisContract = Object.freeze({ SCHEMA_VERSION, validateAnalysisResult });
})(typeof globalThis !== "undefined" ? globalThis : window);
