(function (global) {
  "use strict";

  const PROMPT_SCHEMA_VERSION = "1.0";
  const SUPPORTED_WALK_SCHEMA_VERSION = "1.0";
  const ALLOWED_OPTION_KEYS = new Set(["model", "maxOutputTokens"]);
  const SYSTEM_INSTRUCTIONS = [
    "You are preparing a GPT Plant Walk maintenance analysis from a verified, versioned walk contract.",
    "Treat original observations as source records: preserve their text verbatim and keep issues in the supplied order.",
    "Preserve every supplied work-order number exactly.",
    "Do not invent equipment identities, locations, conditions, causes, risks, repairs, parts, measurements, or work-order numbers.",
    "When the source does not establish a requested fact, use the exact phrase: Field verification required.",
    "Keep source facts separate from engineering assessment and make uncertainty explicit."
  ].join("\n");

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return Object.prototype.toString.call(value) === "[object Object]" &&
      (prototype === null || (prototype.constructor && prototype.constructor.name === "Object"));
  }

  function assertExactKeys(value, allowed, label) {
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) throw new TypeError(`${label} contains unsupported field: ${key}.`);
    }
  }

  function validateNormalizedWalk(walk) {
    if (!isPlainObject(walk)) throw new TypeError("Prompt builder walk must be a normalized plain object.");
    assertExactKeys(walk, new Set(["schemaVersion", "walkId", "createdAt", "completedAt", "site", "inspector", "issues"]), "Normalized walk");
    if (walk.schemaVersion !== SUPPORTED_WALK_SCHEMA_VERSION) throw new TypeError("Prompt builder requires a supported normalized walk schema version.");
    if (typeof walk.walkId !== "string" || !walk.walkId.trim()) throw new TypeError("Normalized walkId is required.");
    if (!Array.isArray(walk.issues) || walk.issues.length === 0) throw new TypeError("Normalized walk issues are required.");
    walk.issues.forEach((issue, index) => {
      if (!isPlainObject(issue)) throw new TypeError(`Normalized issue ${index + 1} must be a plain object.`);
      assertExactKeys(issue, new Set(["issueId", "order", "observedAt", "workOrderNumber", "observation", "photos"]), `Normalized issue ${index + 1}`);
      if (issue.order !== index + 1) throw new TypeError(`Normalized issue ${index + 1} has invalid ordering.`);
      if (typeof issue.issueId !== "string" || !issue.issueId.trim()) throw new TypeError(`Normalized issue ${index + 1} id is required.`);
      if (typeof issue.observation !== "string" || !issue.observation.trim()) throw new TypeError(`Normalized issue ${index + 1} observation is required.`);
      if (!Array.isArray(issue.photos)) throw new TypeError(`Normalized issue ${index + 1} photos must be an array.`);
      issue.photos.forEach((photo, photoIndex) => {
        if (!isPlainObject(photo)) throw new TypeError(`Normalized issue ${index + 1} photo ${photoIndex + 1} must be a plain object.`);
        assertExactKeys(photo, new Set(["id", "reference", "mediaType", "name", "capturedAt"]), `Normalized issue ${index + 1} photo ${photoIndex + 1}`);
        if (typeof photo.reference !== "string" || !photo.reference.trim()) throw new TypeError(`Normalized issue ${index + 1} photo ${photoIndex + 1} reference is required.`);
      });
    });
  }

  function validateOptions(options) {
    if (options === undefined) return Object.freeze({ model: null, maxOutputTokens: null });
    if (!isPlainObject(options)) throw new TypeError("Prompt options must be a plain object.");
    assertExactKeys(options, ALLOWED_OPTION_KEYS, "Prompt options");
    if (options.model !== undefined && (typeof options.model !== "string" || !options.model.trim())) throw new TypeError("Prompt option model must be a non-empty string.");
    if (options.maxOutputTokens !== undefined && (!Number.isInteger(options.maxOutputTokens) || options.maxOutputTokens < 1)) throw new TypeError("Prompt option maxOutputTokens must be a positive integer.");
    return Object.freeze({ model: options.model || null, maxOutputTokens: options.maxOutputTokens || null });
  }

  function cloneForPrompt(walk) {
    return JSON.parse(JSON.stringify(walk));
  }

  function buildPromptRequest(normalizedWalk, options) {
    validateNormalizedWalk(normalizedWalk);
    const promptOptions = validateOptions(options);
    const source = cloneForPrompt(normalizedWalk);
    const userContent = `Analyze this normalized GPT Plant Walk contract. Return analysis for this walk only.\n${JSON.stringify(source)}`;
    const request = {
      promptSchemaVersion: PROMPT_SCHEMA_VERSION,
      model: promptOptions.model,
      maxOutputTokens: promptOptions.maxOutputTokens,
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTIONS },
        { role: "user", content: userContent }
      ],
      metadata: {
        walkId: normalizedWalk.walkId,
        walkSchemaVersion: normalizedWalk.schemaVersion,
        promptSchemaVersion: PROMPT_SCHEMA_VERSION,
        issueCount: normalizedWalk.issues.length
      }
    };
    request.messages.forEach(Object.freeze);
    Object.freeze(request.messages);
    Object.freeze(request.metadata);
    return Object.freeze(request);
  }

  global.promptBuilder = Object.freeze({ PROMPT_SCHEMA_VERSION, SYSTEM_INSTRUCTIONS, buildPromptRequest });
})(typeof globalThis !== "undefined" ? globalThis : window);
