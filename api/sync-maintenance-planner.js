const MAX_REQUEST_BYTES = 256 * 1024;
const DEFAULT_PLANNER_URL = "https://maintenance-planner.dternosky0709.chatgpt.site";

function sendJson(response, status, payload) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.status(status).json(payload);
}

function reject(response, status, code, message) {
  sendJson(response, status, { contractVersion: "1.0", intakeStatus: "rejected", error: { code, message } });
}

function object(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function identifier(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}

function validatePayload(value) {
  if (!object(value) || value.contractVersion !== "1.0" || !identifier(value.eventId) || Number.isNaN(Date.parse(value.sentAt))) return false;
  if (!object(value.source) || value.source.application !== "plant-walk" || typeof value.source.deployment !== "string") return false;
  if (!identifier(value.source.plantWalkId) || !identifier(value.source.observationId)) return false;
  if (!object(value.workOrder) || !identifier(value.workOrder.id) || typeof value.workOrder.title !== "string" || !value.workOrder.title.trim() || value.workOrder.title.length > 240) return false;
  if (!["Immediate", "Urgent", "Planned", "Monitor"].includes(value.workOrder.initialPriority)) return false;
  if (!object(value.observation) || typeof value.observation.text !== "string" || !value.observation.text.trim() || value.observation.text.length > 12000) return false;
  if (Number.isNaN(Date.parse(value.observation.observedAt)) || !Array.isArray(value.observation.photoReferences) || value.observation.photoReferences.length > 12) return false;
  return value.observation.photoReferences.every(photo => object(photo) && identifier(photo.photoId) && (photo.url === undefined || (typeof photo.url === "string" && photo.url.startsWith("https://"))));
}

function parseBody(request) {
  const contentLength = Number(request.headers && request.headers["content-length"] || 0);
  if (contentLength > MAX_REQUEST_BYTES) return { error: "PAYLOAD_TOO_LARGE" };
  const raw = request.body;
  if (Buffer.isBuffer(raw) || typeof raw === "string") {
    const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : raw;
    if (Buffer.byteLength(text, "utf8") > MAX_REQUEST_BYTES) return { error: "PAYLOAD_TOO_LARGE" };
    try { return { value: JSON.parse(text) }; } catch { return { error: "INVALID_JSON" }; }
  }
  if (!object(raw)) return { error: "INVALID_JSON" };
  const serialized = JSON.stringify(raw);
  if (Buffer.byteLength(serialized, "utf8") > MAX_REQUEST_BYTES) return { error: "PAYLOAD_TOO_LARGE" };
  return { value: raw };
}

export default async function handler(request, response) {
  if (request.method !== "POST") return reject(response, 405, "METHOD_NOT_ALLOWED", "Method not allowed. Use POST.");
  const contentType = String(request.headers && request.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") return reject(response, 415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  const parsed = parseBody(request);
  if (parsed.error === "PAYLOAD_TOO_LARGE") return reject(response, 413, parsed.error, "The intake payload exceeds 256 KB.");
  if (parsed.error) return reject(response, 400, parsed.error, "The request body must contain valid JSON.");
  if (!validatePayload(parsed.value)) return reject(response, 422, "INVALID_PAYLOAD", "The work order does not match the Plant Walk intake contract.");

  const intakeToken = process.env.PLANT_WALK_INTAKE_TOKEN;
  if (!intakeToken || intakeToken.length < 32) return reject(response, 503, "PLANNER_AUTH_NOT_CONFIGURED", "Maintenance Planner synchronization is not configured.");
  const plannerBaseUrl = String(process.env.MAINTENANCE_PLANNER_URL || DEFAULT_PLANNER_URL).replace(/\/+$/, "");
  const headers = { "Content-Type": "application/json", "x-plant-walk-token": intakeToken };
  if (process.env.MAINTENANCE_PLANNER_SITE_TOKEN) {
    headers["OAI-Sites-Authorization"] = `Bearer ${process.env.MAINTENANCE_PLANNER_SITE_TOKEN}`;
  }

  try {
    const plannerResponse = await fetch(`${plannerBaseUrl}/api/v1/work-orders/intake`, {
      method: "POST",
      headers,
      body: JSON.stringify(parsed.value),
      signal: AbortSignal.timeout(15000)
    });
    let result;
    try { result = await plannerResponse.json(); } catch { return reject(response, 502, "INVALID_PLANNER_RESPONSE", "Maintenance Planner returned an invalid response."); }
    if (!object(result)) return reject(response, 502, "INVALID_PLANNER_RESPONSE", "Maintenance Planner returned an invalid response.");
    return sendJson(response, plannerResponse.status, result);
  } catch (error) {
    console.error("Maintenance Planner sync proxy failed", error);
    return reject(response, 503, "PLANNER_UNAVAILABLE", "Maintenance Planner is temporarily unavailable. Plant Walk will retry.");
  }
}

export const endpointInternals = Object.freeze({ MAX_REQUEST_BYTES, validatePayload, parseBody });
