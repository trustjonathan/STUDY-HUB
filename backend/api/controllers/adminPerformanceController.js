const { getOpenAiKeys, withOpenAiClient } = require('../../services/openAiKeyPool');
const performanceMonitoringService = require('../../services/performanceMonitoringService');

async function getMetrics(req, res) {
  try {
    const metrics = await performanceMonitoringService.getDashboardMetrics();
    return res.json({ metrics });
  } catch (error) {
    console.error('Admin performance metrics could not be loaded:', error);
    return res.status(503).json({ error: 'Performance metrics are temporarily unavailable.' });
  }
}

async function getInsights(req, res) {
  if (!getOpenAiKeys().length) {
    return res.status(503).json({ error: 'AI insights are unavailable because no OpenAI key is configured.' });
  }

  try {
    const metrics = await performanceMonitoringService.getDashboardMetrics();
    const response = await withOpenAiClient((client) => client.responses.create({
      model: 'gpt-4.1-mini',
      max_output_tokens: 650,
      input: [
        {
          role: 'system',
          content: 'You are Study Hub’s operations analyst. Analyze only the supplied aggregate application metrics. Do not infer causes that are not evidenced. Return: (1) a concise health summary, (2) up to three prioritized observations with the metric behind each, and (3) practical next checks. If data is missing or process-local, state the limitation. Never request or expose personal data. Keep the response concise and do not claim to have changed the application.',
        },
        {
          role: 'user',
          content: JSON.stringify(metrics),
        },
      ],
    }, { signal: AbortSignal.timeout(25_000) }));

    if (typeof response.output_text !== 'string' || !response.output_text.trim()) {
      throw new Error('The AI provider returned an empty analysis.');
    }

    return res.json({
      model: 'gpt-4.1-mini',
      generatedAt: new Date().toISOString(),
      insights: response.output_text.trim(),
    });
  } catch (error) {
    console.error('Admin performance AI analysis failed:', error instanceof Error ? error.message : 'Unknown error');
    const status = error.status === 503 ? 503 : error.name === 'TimeoutError' ? 504 : 502;
    return res.status(status).json({ error: 'AI performance analysis could not be completed. Refresh the metrics and try again.' });
  }
}

module.exports = { getInsights, getMetrics };
