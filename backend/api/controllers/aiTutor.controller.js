import OpenAI from "openai";

export async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userMessage } = req.body;
    if (!userMessage) {
      return res.status(400).json({ error: "No user message provided." });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are BioGPT. You ONLY answer Biology questions for UACE students. Keep answers clear and accurate."
        },
        { role: "user", content: userMessage }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch GPT response." });
  }
}