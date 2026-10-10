const OpenAI = require("openai");

exports.askAI = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required"
      });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        message: "The OpenAI service is not configured."
      });
    }

    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt
    });

    const reply = response.output_text;

    res.json({
      success: true,
      response: reply
    });

  } catch (error) {
    console.error("AI Error:", error);

    res.status(500).json({
      success: false,
      message: "AI request failed"
    });
  }
};