import "../analysis-contract.js";
import "../prompt-builder.js";

const MAX_REQUEST_BYTES = 256 * 1024;
const MAX_ISSUES = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_REQUESTS = 30;
const rateBuckets = new Map();

function sendJson(response, status, payload) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.status(status).json(payload);
}

function fail(response, status, code, message) {
  sendJson(response, status, { error: { code, message } });
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

function hasExactKeys(value, keys) {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key));
}

function parseBody(request) {
  const contentLength = Number(request.headers && request.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return { error: "too_large" };
  }
  const raw = request.body;
  if (Buffer.isBuffer(raw) || typeof raw === "string") {
    const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : raw;
    if (Buffer.byteLength(text, "utf8") > MAX_REQUEST_BYTES) return { error: "too_large" };
    try { return { value: JSON.parse(text) }; } catch { return { error: "malformed_json" }; }
  }
  if (!isPlainObject(raw)) return { error: "malformed_json" };
  let serialized;
  try { serialized = JSON.stringify(raw); } catch { return { error: "malformed_json" }; }
  if (Buffer.byteLength(serialized, "utf8") > MAX_REQUEST_BYTES) return { error: "too_large" };
  return { value: raw };
}

function validateRequest(value) {
  if (!isPlainObject(value) || !hasExactKeys(value, ["promptSchemaVersion", "model", "maxOutputTokens", "messages", "metadata"])) return null;
  if (value.promptSchemaVersion !== "1.0" || (value.model !== null && (typeof value.model !== "string" || !value.model.trim()))) return null;
  if (value.maxOutputTokens !== null && (!Number.isInteger(value.maxOutputTokens) || value.maxOutputTokens < 1)) return null;
  if (!Array.isArray(value.messages) || value.messages.length !== 2) return null;
  if (!value.messages.every(message => isPlainObject(message) && hasExactKeys(message, ["role", "content"]) && typeof message.content === "string")) return null;
  if (value.messages[0].role !== "system" || value.messages[1].role !== "user") return null;
  if (value.messages[0].content !== globalThis.promptBuilder.SYSTEM_INSTRUCTIONS) return null;
  if (!isPlainObject(value.metadata) || !hasExactKeys(value.metadata, ["walkId", "walkSchemaVersion", "promptSchemaVersion", "issueCount"])) return null;
  if (typeof value.metadata.walkId !== "string" || !value.metadata.walkId.trim() || value.metadata.walkId.length > 200) return null;
  if (value.metadata.walkSchemaVersion !== "1.0" || value.metadata.promptSchemaVersion !== "1.0") return null;
  if (!Number.isInteger(value.metadata.issueCount) || value.metadata.issueCount < 1 || value.metadata.issueCount > MAX_ISSUES) return null;
  const separator = value.messages[1].content.indexOf("\n");
  if (separator < 0) return null;
  let walk;
  try { walk = JSON.parse(value.messages[1].content.slice(separator + 1)); } catch { return null; }
  if (!isPlainObject(walk) || !hasExactKeys(walk, ["schemaVersion", "walkId", "createdAt", "completedAt", "site", "inspector", "issues"])) return null;
  if (walk.schemaVersion !== "1.0" || walk.walkId !== value.metadata.walkId || !Array.isArray(walk.issues)) return null;
  if (walk.issues.length !== value.metadata.issueCount || walk.issues.length > MAX_ISSUES) return null;
  const ids = new Set();
  for (let index = 0; index < walk.issues.length; index += 1) {
    const issue = walk.issues[index];
    if (!isPlainObject(issue) || !hasExactKeys(issue, ["issueId", "order", "observedAt", "workOrderNumber", "observation", "photos"])) return null;
    if (typeof issue.issueId !== "string" || !issue.issueId.trim() || issue.order !== index + 1 || typeof issue.observation !== "string" || !issue.observation.trim() || !Array.isArray(issue.photos)) return null;
    if (ids.has(issue.issueId)) return null;
    ids.add(issue.issueId);
    for (const photo of issue.photos) {
      if (!isPlainObject(photo) || !hasExactKeys(photo, ["id", "reference", "mediaType", "name", "capturedAt"])) return null;
      if (typeof photo.reference !== "string" || !photo.reference.trim()) return null;
    }
  }
  return walk;
}

function clientKey(request) {
  const forwarded = request.headers && request.headers["x-forwarded-for"];
  return String(forwarded || (request.socket && request.socket.remoteAddress) || "local").split(",")[0].trim();
}

function isRateLimited(request, now = Date.now()) {
  const key = clientKey(request);
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_REQUESTS;
}

function createMockAnalysis(request, walk) {
  return {
    schemaVersion: "1.0",
    walkId: request.metadata.walkId,
    provider: "mock-server",
    model: request.model || "mock-v1",
    status: "completed",
    summary: "Mock server analysis only. No hosted AI request was made.",
    issues: walk.issues.map(issue => ({
      issueId: issue.issueId,
      order: issue.order,
      priority: issue.order === 1 ? "high" : "medium",
      trade: "Field verification required",
      recommendation: "Field verification required"
    }))
  };
}

export default async function handler(request, response) {
  if (request.method !== "POST") return fail(response, 405, "METHOD_NOT_ALLOWED", "Method not allowed. Use POST.");
  const contentType = String((request.headers && request.headers["content-type"]) || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") return fail(response, 415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  if (isRateLimited(request)) return fail(response, 429, "RATE_LIMITED", "Too many requests. Try again shortly.");

  const parsed = parseBody(request);
  if (parsed.error === "too_large") return fail(response, 413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  if (parsed.error) return fail(response, 400, "MALFORMED_JSON", "Request body must contain valid JSON.");
  const walk = validateRequest(parsed.value);
  if (!walk) return fail(response, 400, "INVALID_REQUEST", "Request does not match the supported AI request schema.");

  try {
    const analysis = createMockAnalysis(parsed.value, walk);
    const validated = globalThis.analysisContract.validateAnalysisResult(analysis, {
      walkId: walk.walkId,
      issueIds: walk.issues.map(issue => issue.issueId)
    });
    sendJson(response, 200, validated);
  } catch (error) {
    console.error("AI analysis endpoint failed", error);
    fail(response, 500, "INTERNAL_ERROR", "The analysis request could not be completed.");
  }
}

export const endpointInternals = Object.freeze({ MAX_REQUEST_BYTES, validateRequest, createMockAnalysis });
