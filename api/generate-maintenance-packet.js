const PDFBOLT_DIRECT_URL = "https://api.pdfbolt.com/v1/direct";
const DEFAULT_TEMPLATE_ID = "408df28f-e62c-433e-aefe-ab600eca51a2";
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "no-store");
}

function sendJson(response, status, payload) {
  response.status(status).json(payload);
}

function validatePacket(packet) {
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
    return "Packet data must be a JSON object.";
  }

  if (!packet.report || typeof packet.report !== "object") {
    return "Packet data is missing the report object.";
  }

  if (!Array.isArray(packet.issues)) {
    return "Packet data is missing the issues array.";
  }

  if (packet.issues.length === 0) {
    return "At least one issue is required to generate a maintenance packet.";
  }

  return null;
}

export default async function handler(request, response) {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed. Use POST." });
    return;
  }

  const apiKey = process.env.PDFBOLT_API_KEY;
  const templateId = process.env.PDFBOLT_TEMPLATE_ID || DEFAULT_TEMPLATE_ID;

  if (!apiKey) {
    sendJson(response, 500, {
      error: "PDFBolt is not configured. Add PDFBOLT_API_KEY to the deployment environment."
    });
    return;
  }

  try {
    const packet = request.body && request.body.templateData
      ? request.body.templateData
      : request.body;

    const validationError = validatePacket(packet);
    if (validationError) {
      sendJson(response, 400, { error: validationError });
      return;
    }

    const serialized = JSON.stringify(packet);
    if (Buffer.byteLength(serialized, "utf8") > MAX_REQUEST_BYTES) {
      sendJson(response, 413, {
        error: "The maintenance packet is too large to send. Reduce the number or size of photos and try again."
      });
      return;
    }

    const pdfBoltResponse = await fetch(PDFBOLT_DIRECT_URL, {
      method: "POST",
      headers: {
        "API-KEY": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        templateId,
        templateData: packet,
        format: "Letter",
        printBackground: true
      })
    });

    if (!pdfBoltResponse.ok) {
      const contentType = pdfBoltResponse.headers.get("content-type") || "";
      const details = contentType.includes("application/json")
        ? await pdfBoltResponse.json().catch(() => null)
        : await pdfBoltResponse.text().catch(() => "");

      console.error("PDFBolt generation failed", pdfBoltResponse.status, details);
      sendJson(response, pdfBoltResponse.status, {
        error: "PDFBolt could not generate the maintenance packet.",
        details
      });
      return;
    }

    const pdfBuffer = Buffer.from(await pdfBoltResponse.arrayBuffer());
    const safeWalkId = String(packet.report.walkId || "plant-walk").replace(/[^a-zA-Z0-9_-]/g, "-");

    response.status(200);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="GPT-Plant-Walk-${safeWalkId}.pdf"`);
    response.setHeader("Content-Length", String(pdfBuffer.length));
    response.end(pdfBuffer);
  } catch (error) {
    console.error("Maintenance packet endpoint failed", error);
    sendJson(response, 500, {
      error: "The maintenance packet could not be generated.",
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
