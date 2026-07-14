(function (global) {
  "use strict";

  const MOCK_PROVIDER_NAME = "mock";

  function normalizeWalk(walk) {
    if (!global.walkContract || typeof global.walkContract.normalizeWalkForAi !== "function") {
      throw new Error("The AI walk data contract must be loaded before creating an analysis request.");
    }
    return global.walkContract.normalizeWalkForAi(walk);
  }

  function validateProvider(provider) {
    if (!provider || typeof provider.analyzeWalk !== "function") {
      throw new TypeError("An AI provider with analyzeWalk(walk) is required.");
    }
  }

  function validateAnalysis(analysis) {
    if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
      throw new TypeError("AI provider must return an analysis object.");
    }
    if (typeof analysis.walkId !== "string" || !analysis.walkId.trim()) {
      throw new TypeError("AI analysis must include a walkId.");
    }
    if (!Array.isArray(analysis.findings)) {
      throw new TypeError("AI analysis findings must be an array.");
    }
  }

  function createAiService(options) {
    const provider = options && options.provider;
    validateProvider(provider);

    return Object.freeze({
      async analyzeWalk(walk) {
        const normalizedWalk = normalizeWalk(walk);
        const analysis = await provider.analyzeWalk(normalizedWalk);
        validateAnalysis(analysis);
        if (analysis.walkId !== normalizedWalk.walkId) {
          throw new Error("AI analysis walkId must match the requested walk.");
        }
        return analysis;
      }
    });
  }

  function createMockAiProvider(config) {
    const providerConfig = config || { providerMode: MOCK_PROVIDER_NAME, model: "mock-v1" };
    return Object.freeze({
      name: MOCK_PROVIDER_NAME,
      config: providerConfig,
      async analyzeWalk(walk) {
        return {
          walkId: walk.walkId,
          provider: MOCK_PROVIDER_NAME,
          status: "mock",
          summary: "Mock analysis only. No hosted AI request was made.",
          findings: walk.issues.map((issue, index) => ({
            issueId: issue.issueId,
            sequence: issue.order,
            observation: issue.observation
          }))
        };
      }
    });
  }

  function createConfiguredAiService(configOverrides) {
    if (!global.aiConfig || typeof global.aiConfig.createAiConfig !== "function") {
      throw new Error("AI configuration layer must be loaded before creating the configured AI service.");
    }
    const config = global.aiConfig.createAiConfig(configOverrides);
    if (config.providerMode !== MOCK_PROVIDER_NAME) {
      throw new Error("Only mock AI provider mode is available in this release.");
    }
    return createAiService({ provider: createMockAiProvider(config) });
  }

  global.aiService = Object.freeze({
    createAiService,
    createMockAiProvider,
    createConfiguredAiService
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
