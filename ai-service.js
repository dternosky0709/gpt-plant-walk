(function (global) {
  "use strict";

  const MOCK_PROVIDER_NAME = "mock";

  function normalizeWalk(walk) {
    if (!global.walkContract || typeof global.walkContract.normalizeWalkForAi !== "function") {
      throw new Error("The AI walk data contract must be loaded before creating an analysis request.");
    }
    return global.walkContract.normalizeWalkForAi(walk);
  }

  function buildRequest(walk, promptOptions) {
    if (!global.promptBuilder || typeof global.promptBuilder.buildPromptRequest !== "function") {
      throw new Error("The AI prompt builder must be loaded before creating an analysis request.");
    }
    return global.promptBuilder.buildPromptRequest(walk, promptOptions);
  }

  function validateProvider(provider) {
    if (!provider || typeof provider.analyzeWalk !== "function") {
      throw new TypeError("An AI provider with analyzeWalk(walk) is required.");
    }
  }

  function validateAnalysis(analysis, normalizedWalk) {
    if (!global.analysisContract || typeof global.analysisContract.validateAnalysisResult !== "function") {
      throw new Error("The AI analysis response contract must be loaded before handling a provider response.");
    }
    return global.analysisContract.validateAnalysisResult(analysis, {
      walkId: normalizedWalk.walkId,
      issueIds: normalizedWalk.issues.map(issue => issue.issueId)
    });
  }

  function timeoutError(timeoutMs) {
    const error = new Error(`AI provider request timed out after ${timeoutMs} ms.`);
    error.name = "AiTimeoutError";
    error.code = "AI_TIMEOUT";
    return error;
  }

  function runAttempt(provider, request, timeoutMs) {
    if (!timeoutMs) return provider.analyzeWalk(request);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(timeoutError(timeoutMs)), timeoutMs);
      Promise.resolve().then(() => provider.analyzeWalk(request)).then(
        value => { clearTimeout(timer); resolve(value); },
        error => { clearTimeout(timer); reject(error); }
      );
    });
  }

  function createAiService(options) {
    const provider = options && options.provider;
    const promptOptions = options && options.promptOptions;
    const runtimeConfig = options && options.runtimeConfig;
    validateProvider(provider);

    return Object.freeze({
      async analyzeWalk(walk) {
        const normalizedWalk = normalizeWalk(walk);
        const request = buildRequest(normalizedWalk, promptOptions);
        const retryCount = runtimeConfig ? runtimeConfig.retryCount : 0;
        let lastError;
        for (let attempt = 0; attempt <= retryCount; attempt += 1) {
          try {
            const analysis = await runAttempt(provider, request, runtimeConfig && runtimeConfig.requestTimeoutMs);
            return validateAnalysis(analysis, normalizedWalk);
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError;
      }
    });
  }

  function createMockAiProvider(config) {
    const providerConfig = config || { providerMode: MOCK_PROVIDER_NAME, model: "mock-v1" };
    return Object.freeze({
      name: MOCK_PROVIDER_NAME,
      config: providerConfig,
      async analyzeWalk(request) {
        const userMessage = request.messages.find(message => message.role === "user");
        const normalizedWalk = JSON.parse(userMessage.content.slice(userMessage.content.indexOf("\n") + 1));
        return {
          schemaVersion: "1.0",
          walkId: request.metadata.walkId,
          provider: MOCK_PROVIDER_NAME,
          model: providerConfig.model || "mock-v1",
          status: "completed",
          summary: "Mock analysis only. No hosted AI request was made.",
          issues: normalizedWalk.issues.map((issue) => ({
            issueId: issue.issueId,
            order: issue.order,
            priority: "Planned",
            trade: "Field verification required",
            recommendation: "Field verification required"
          }))
        };
      }
    });
  }

  function createHttpAiProvider(options) {
    const endpoint = options && options.endpoint;
    const fetchImpl = options && options.fetchImpl || global.fetch;
    if (typeof endpoint !== "string" || !endpoint.trim()) throw new TypeError("AI endpoint is required.");
    if (typeof fetchImpl !== "function") throw new TypeError("Fetch is required for the hosted AI provider.");
    return Object.freeze({
      name: "openai-server",
      async analyzeWalk(request) {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request)
        });
        let payload = null;
        try { payload = await response.json(); } catch {}
        if (!response.ok) {
          const error = new Error(payload && payload.error && payload.error.message || "AI analysis is temporarily unavailable.");
          error.code = payload && payload.error && payload.error.code || `HTTP_${response.status}`;
          throw error;
        }
        return payload;
      }
    });
  }

  function createConfiguredAiService(configOverrides) {
    if (!global.aiConfig || typeof global.aiConfig.createAiConfig !== "function") {
      throw new Error("AI configuration layer must be loaded before creating the configured AI service.");
    }
    const config = global.aiConfig.createAiConfig(configOverrides);
    const provider = config.providerMode === MOCK_PROVIDER_NAME
      ? createMockAiProvider(config)
      : config.providerMode === "openai-server"
        ? createHttpAiProvider({ endpoint: config.apiEndpoint })
        : null;
    if (!provider) throw new Error("Unsupported AI provider mode.");
    return createAiService({
      provider,
      promptOptions: { model: config.model, maxOutputTokens: config.maxOutputTokens },
      runtimeConfig: config
    });
  }

  global.aiService = Object.freeze({
    createAiService,
    createMockAiProvider,
    createHttpAiProvider,
    createConfiguredAiService
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
