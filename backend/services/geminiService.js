const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.8-flash";
const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash";

function endpointFor(model) {
  return new URL(`${API_BASE_URL}/${encodeURIComponent(model)}:generateContent`);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestModel(apiKey, model, payload, attempts = 3) {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(endpointFor(model), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify(payload)
      });

      if (response.status !== 503 || attempt === attempts - 1) return response;
      await wait(400 * (attempt + 1));
    } catch (error) {
      if (error && error.name === "TimeoutError") throw error;
      lastError = error;
      if (attempt < attempts - 1) await wait(400 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini request failed.");
}

async function generateContent(apiKey, payload) {
  const primaryModel = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK_MODEL;
  let response;
  try {
    response = await requestModel(apiKey, primaryModel, payload);
  } catch (error) {
    if (fallbackModel === primaryModel) throw error;
    console.warn(`Gemini model ${primaryModel} failed; trying the configured fallback model.`);
    return requestModel(apiKey, fallbackModel, payload);
  }

  if (![429, 503].includes(response.status) || fallbackModel === primaryModel) {
    return response;
  }

  console.warn(
    `Gemini model ${primaryModel} returned HTTP ${response.status}; trying the configured fallback model.`
  );
  return requestModel(apiKey, fallbackModel, payload);
}

module.exports = { generateContent };
