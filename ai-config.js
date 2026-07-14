(function (global) {
  "use strict";

  const DEFAULTS = Object.freeze({
    providerMode: "mock",
    model: "mock-v1",
    requestTimeoutMs: 30000,
    retryCount: 0,
    retryPolicy: "none",
    maxOutputTokens: 4096,
    debug: false,
    apiEndpoint: null,
    featureFlags: Object.freeze({})
  });

  const RETRY_POLICIES = new Set(["none", "fixed", "exponential"]);

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  function requireNonEmptyString(value, field) {
    if (typeof value !== "string" || !value.trim()) {
      throw new TypeError(`AI configuration ${field} must be a non-empty string.`);
    }
  }

  function requirePositiveInteger(value, field, allowZero) {
    if (!Number.isInteger(value) || value < (allowZero ? 0 : 1)) {
      throw new TypeError(`AI configuration ${field} must be ${allowZero ? "a non-negative" : "a positive"} integer.`);
    }
  }

  function createAiConfig(overrides) {
    if (overrides !== undefined && !isPlainObject(overrides)) {
      throw new TypeError("AI configuration overrides must be an object.");
    }

    const values = overrides || {};
    if (values.featureFlags !== undefined && !isPlainObject(values.featureFlags)) {
      throw new TypeError("AI configuration featureFlags must be an object.");
    }
    const config = {
      ...DEFAULTS,
      ...values,
      featureFlags: { ...DEFAULTS.featureFlags, ...(values.featureFlags || {}) }
    };

    requireNonEmptyString(config.providerMode, "providerMode");
    requireNonEmptyString(config.model, "model");
    requirePositiveInteger(config.requestTimeoutMs, "requestTimeoutMs", false);
    requirePositiveInteger(config.retryCount, "retryCount", true);
    requirePositiveInteger(config.maxOutputTokens, "maxOutputTokens", false);

    if (!RETRY_POLICIES.has(config.retryPolicy)) {
      throw new TypeError("AI configuration retryPolicy must be none, fixed, or exponential.");
    }
    if (config.retryCount > 0 && config.retryPolicy === "none") {
      throw new TypeError("AI configuration retryPolicy cannot be none when retryCount is greater than zero.");
    }
    if (typeof config.debug !== "boolean") {
      throw new TypeError("AI configuration debug must be a boolean.");
    }
    if (config.apiEndpoint !== null && (typeof config.apiEndpoint !== "string" || !config.apiEndpoint.trim())) {
      throw new TypeError("AI configuration apiEndpoint must be null or a non-empty string.");
    }
    if (!isPlainObject(config.featureFlags)) {
      throw new TypeError("AI configuration featureFlags must be an object.");
    }
    for (const [flag, enabled] of Object.entries(config.featureFlags)) {
      if (typeof enabled !== "boolean") {
        throw new TypeError(`AI feature flag ${flag} must be a boolean.`);
      }
    }

    config.featureFlags = Object.freeze({ ...config.featureFlags });
    return Object.freeze(config);
  }

  global.aiConfig = Object.freeze({
    DEFAULTS,
    createAiConfig
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
