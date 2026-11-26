const axios = require("axios");

const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

function isConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

async function rankStays({ preferences, travelerProfile, candidates }) {
  if (!isConfigured()) return [];
  const schema = {
    type: "object",
    properties: {
      recommendations: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            reason: { type: "string" },
          },
          required: ["id", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["recommendations"],
    additionalProperties: false,
  };

  const response = await axios.post("https://api.openai.com/v1/responses", {
    model: MODEL,
    store: false,
    instructions: "Recommend up to four real vacation stays. Rank them using the traveler's stated filters and anonymous prior stay preferences. Use only candidate IDs, invent no facts, and return a concise reason based only on the supplied fields.",
    input: JSON.stringify({ preferences, travelerProfile, candidates }),
    max_output_tokens: 700,
    text: { format: { type: "json_schema", name: "stay_recommendations", strict: true, schema } },
  }, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    timeout: 15000,
  });

  const message = (response.data.output || []).find((item) => item.type === "message");
  const outputText = message?.content?.find((item) => item.type === "output_text")?.text;
  if (!outputText) return [];
  const result = JSON.parse(outputText);
  const allowedIds = new Set(candidates.map((candidate) => candidate.id));
  return (result.recommendations || [])
    .filter((item) => allowedIds.has(item.id) && typeof item.reason === "string")
    .slice(0, 4)
    .map((item) => ({ id: item.id, reason: item.reason.trim().slice(0, 240) }));
}

module.exports = { isConfigured, rankStays };
