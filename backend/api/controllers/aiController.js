const { getOpenAiKeys, withOpenAiClient } = require("../../services/openAiKeyPool");

exports.askAI = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required"
      });
    }

    if (!getOpenAiKeys().length) {
      return res.status(503).json({
        success: false,
        message: "The OpenAI service is not configured."
      });
    }

    const reply = await withOpenAiClient(async (client) => {
      const response = await client.responses.create({
        model: "gpt-4.1-mini",
        input: prompt
      });
      return response.output_text;
    });

    res.json({
      success: true,
      response: reply
    });

  } catch (error) {
    console.error("AI request failed.", error instanceof Error ? error.message : "Unknown error");

    res.status(error.status === 503 ? 503 : 500).json({
      success: false,
      message: "AI request failed"
    });
  }
};