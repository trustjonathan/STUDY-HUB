const MAX_IMAGE_LENGTH = 900_000;
const MAX_PROMPT_LENGTH = 1_500;
const MAX_HISTORY_MESSAGES = 10;

function invalidRequest(res, message) {
  return res.status(400).json({ error: message });
}

exports.handler = async (req, res) => {
  const { prompt, pageNumber, pageImage, history = [] } = req.body || {};

  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > MAX_PROMPT_LENGTH) {
    return invalidRequest(res, `Enter a question of no more than ${MAX_PROMPT_LENGTH} characters.`);
  }
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 100_000) {
    return invalidRequest(res, "A valid PDF page number is required.");
  }
  if (
    typeof pageImage !== "string" ||
    pageImage.length > MAX_IMAGE_LENGTH ||
    pageImage.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(pageImage)
  ) {
    return invalidRequest(res, "A valid PDF page image is required.");
  }
  if (
    !Array.isArray(history) ||
    history.length > MAX_HISTORY_MESSAGES ||
    history.some((message) =>
      !message ||
      !["user", "model"].includes(message.role) ||
      typeof message.text !== "string" ||
      !message.text.trim() ||
      message.text.length > MAX_PROMPT_LENGTH
    )
  ) {
    return invalidRequest(res, "The conversation history is invalid.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Gemini tutor request rejected: GEMINI_API_KEY is not configured.");
    return res.status(503).json({ error: "The study companion is not configured yet." });
  }

  const contents = history.map(({ role, text }) => ({
    role,
    parts: [{ text }]
  }));
  contents.push({
    role: "user",
    parts: [
      { text: `The student is viewing PDF page ${pageNumber}. ${prompt.trim()}` },
      { inline_data: { mime_type: "image/jpeg", data: pageImage } }
    ]
  });

  try {
    const endpoint = new URL(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"
    );
    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: "You are Study Hub's helpful tutor for Ugandan learners. Explain the supplied document page accurately and clearly, adapting explanations to the student's question. Show steps for calculations and explain diagrams from visible evidence. If the page does not contain enough information, say so rather than inventing details. Curriculum guidance should be framed as general study help, not as an official NCDC or UNEB ruling."
          }]
        },
        contents,
        generationConfig: { maxOutputTokens: 1_000, temperature: 0.3 }
      })
    });

    if (!geminiResponse.ok) {
      console.error(`Gemini tutor request failed with HTTP ${geminiResponse.status}.`);
      return res.status(geminiResponse.status === 429 ? 429 : 502).json({
        error: geminiResponse.status === 429
          ? "The study companion is busy. Please try again shortly."
          : "The study companion could not answer right now."
      });
    }

    const result = await geminiResponse.json();
    const reply = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      console.error("Gemini tutor returned no text response.");
      return res.status(502).json({ error: "The study companion returned an empty answer." });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error(
      "Gemini tutor request failed:",
      error instanceof Error ? error.name : "Unknown error"
    );
    return res.status(502).json({ error: "The study companion could not answer right now." });
  }
};
