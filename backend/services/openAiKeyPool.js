const OpenAI = require('openai');

const KEY_ENV_NAMES = [
  'OPEN_AI_API_KEY',
  'OPEN_AI_API_KEY_1',
  'OPEN_AI_API_KEY_2',
  'OPENAI_API_KEY',
  'OPENAI_KEY',
];

const RETRYABLE_STATUSES = new Set([401, 403, 408, 409, 429, 500, 502, 503, 504]);

function getOpenAiKeys() {
  return [...new Set(KEY_ENV_NAMES
    .map((name) => process.env[name]?.trim())
    .filter(Boolean))];
}

function canRetry(error) {
  const status = Number(error?.status || error?.statusCode);
  return error?.retryable === true
    || error?.name === 'APIConnectionError'
    || error?.name === 'APIConnectionTimeoutError'
    || RETRYABLE_STATUSES.has(status)
    || status >= 500;
}

function noKeysConfigured() {
  const error = new Error('The OpenAI service is not configured.');
  error.status = 503;
  return error;
}

async function withOpenAiKey(operation) {
  const keys = getOpenAiKeys();
  if (!keys.length) throw noKeysConfigured();

  let lastError;
  for (let index = 0; index < keys.length; index += 1) {
    try {
      return await operation(keys[index]);
    } catch (error) {
      lastError = error;
      if (!canRetry(error)) throw error;
      if (index < keys.length - 1) {
        const status = Number(error?.status || error?.statusCode);
        console.warn(`OpenAI request failed${status ? ` with HTTP ${status}` : ''}; trying the next configured key.`);
      }
    }
  }

  const status = Number(lastError?.status || lastError?.statusCode);
  const error = new Error('All configured OpenAI keys failed to complete the request.');
  error.status = status === 429 ? 503 : status >= 400 && status < 500 ? status : 503;
  throw error;
}

function withOpenAiClient(operation) {
  return withOpenAiKey((apiKey) => operation(new OpenAI({ apiKey, maxRetries: 0 })));
}

module.exports = { getOpenAiKeys, withOpenAiKey, withOpenAiClient };
