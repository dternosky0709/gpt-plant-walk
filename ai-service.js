(function (global) {
  "use strict";

  const MOCK_PROVIDER_NAME = "mock";

  function validateWalk(walk) {
    if (!walk || typeof walk !== "object" || Array.isArray(walk)) {
      throw new TypeError("A walk object is required.");
    }
    if (typeof walk.id !== "string" || !walk.id.trim()) {
      throw new TypeError("Walk id is required.");
    }
    if (!Array.isArray(walk.issues)) {
      throw new TypeError("Walk issues must be an array.");
    }
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
        validateWalk(walk);
        const analysis = await provider.analyzeWalk(walk);
        validateAnalysis(analysis);
        if (analysis.walkId !== walk.id) {
          throw new Error("AI analysis walkId must match the requested walk.");
        }
        return analysis;
      }
    });
  }

  function createMockAiProvider() {
    return Object.freeze({
      name: MOCK_PROVIDER_NAME,
      async analyzeWalk(walk) {
        return {
          walkId: walk.id,
          provider: MOCK_PROVIDER_NAME,
          status: "mock",
          summary: "Mock analysis only. No hosted AI request was made.",
          findings: walk.issues.map((issue, index) => ({
            issueId: typeof issue.id === "string" ? issue.id : "",
            sequence: index + 1,
            observation: typeof issue.observation === "string" ? issue.observation : ""
          }))
        };
      }
    });
  }

  global.aiService = Object.freeze({
    createAiService,
    createMockAiProvider
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
