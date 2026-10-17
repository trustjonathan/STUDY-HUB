const sequelize = require('../database/config/database');
const { withOpenAiKey } = require('./openAiKeyPool');

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1_536;
const MAX_RELEVANT_MEMORIES = 5;

function asUserId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new TypeError('A valid signed-in learner is required.');
  }
  return id;
}

function toVectorLiteral(embedding) {
  if (
    !Array.isArray(embedding)
    || embedding.length !== EMBEDDING_DIMENSIONS
    || embedding.some((value) => typeof value !== 'number' || !Number.isFinite(value))
  ) {
    throw new Error('The embedding provider returned an invalid vector.');
  }
  return `[${embedding.join(',')}]`;
}

async function createEmbedding(text) {
  let vector;
  try {
    vector = await withOpenAiKey(async (apiKey) => {
      let response;
      try {
        response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            Authorization: ['Bearer', apiKey].join(' '),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        const error = new Error('OpenAI embedding request could not be reached.');
        error.retryable = true;
        throw error;
      }

      if (!response.ok) {
        const error = new Error(`OpenAI embedding request failed with HTTP ${response.status}.`);
        error.status = response.status;
        throw error;
      }

      const result = await response.json();
      return result.data?.[0]?.embedding;
    });
  } catch (error) {
    console.error('OpenAI embedding request could not be completed.', error instanceof Error ? error.message : 'Unknown error');
    const unavailable = new Error('AI study memory could not be created right now. Your tutor answer can still be generated.');
    unavailable.status = 503;
    throw unavailable;
  }
  toVectorLiteral(vector);
  return vector;
}

async function prepareStudyMemory(userId, topic) {
  const id = asUserId(userId);
  const vector = await createEmbedding(topic);
  const embedding = toVectorLiteral(vector);
  const [rows] = await sequelize.query(
    `SELECT topic, created_at
       FROM public.study_hub_ai_memories
      WHERE user_id = :userId
      ORDER BY embedding <=> CAST(:embedding AS vector)
      LIMIT ${MAX_RELEVANT_MEMORIES}`,
    { replacements: { userId: id, embedding } },
  );
  return {
    memories: rows.filter((row) => typeof row.topic === 'string').map((row) => ({
      topic: row.topic,
      createdAt: row.created_at,
    })),
    embedding: vector,
  };
}

async function findRelevantMemories(userId, topic) {
  const prepared = await prepareStudyMemory(userId, topic);
  return prepared.memories;
}

async function saveStudyTopic(userId, topic, preparedEmbedding) {
  const id = asUserId(userId);
  const embedding = toVectorLiteral(preparedEmbedding || await createEmbedding(topic));
  await sequelize.query(
    `INSERT INTO public.study_hub_ai_memories (user_id, topic, embedding)
     VALUES (:userId, :topic, CAST(:embedding AS vector))`,
    { replacements: { userId: id, topic, embedding } },
  );
}

async function exportStudyMemory(userId) {
  const id = asUserId(userId);
  const [rows] = await sequelize.query(
    `SELECT id, topic, embedding::text AS embedding, created_at
       FROM public.study_hub_ai_memories
      WHERE user_id = :userId
      ORDER BY created_at ASC, id ASC`,
    { replacements: { userId: id } },
  );
  return rows;
}

async function deleteStudyMemory(userId) {
  const id = asUserId(userId);
  const [rows] = await sequelize.query(
    `DELETE FROM public.study_hub_ai_memories
      WHERE user_id = :userId
      RETURNING id`,
    { replacements: { userId: id } },
  );
  return rows.length;
}

module.exports = {
  prepareStudyMemory,
  findRelevantMemories,
  saveStudyTopic,
  exportStudyMemory,
  deleteStudyMemory,
};
