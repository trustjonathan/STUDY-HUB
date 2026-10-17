import openAiKeyPool from "../../services/openAiKeyPool.js";

export async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userMessage } = req.body;
    if (!userMessage) {
      return res.status(400).json({ error: "No user message provided." });
    }

    const completion = await openAiKeyPool.withOpenAiClient((openai) => openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are BioGPT. You ONLY answer Biology questions for UACE students. Keep answers clear and accurate."
        },
        { role: "user", content: userMessage }
      ]
    }));

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    console.error("AI tutor request failed.", err instanceof Error ? err.message : "Unknown error");
    return res.status(err.status === 503 ? 503 : 500).json({ error: "Failed to fetch GPT response." });
  }
}