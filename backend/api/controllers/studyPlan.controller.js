const sequelize = require('../../database/config/database');
const User = require('../../database/models/postgres/user');
const { generateContent, generateContentWithModel } = require('../../services/geminiService');

const MAX_CHAT_LENGTH = 500;
const MAX_CANDIDATES = 30;

function readModelJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace < firstBrace) throw new Error('The AI returned an invalid study plan.');
  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

function normalisePlan(value, subjects) {
  if (!value || typeof value !== 'object' || typeof value.title !== 'string' || typeof value.summary !== 'string'
    || !Array.isArray(value.topics) || value.topics.length < 5 || value.topics.length > 7) {
    throw new Error('The AI returned a study plan in an unsupported format.');
  }
  const allowedSubjects = new Set(subjects.map((subject) => subject.toLowerCase()));
  const topics = value.topics.map((topic, index) => {
    if (!topic || typeof topic.title !== 'string' || !topic.title.trim()
      || typeof topic.subject !== 'string' || !topic.subject.trim()
      || typeof topic.objective !== 'string' || !topic.objective.trim()
      || typeof topic.practice !== 'string' || !topic.practice.trim()) {
      throw new Error('The AI returned an incomplete study topic.');
    }
    const subject = subjects.find((item) => item.toLowerCase() === topic.subject.trim().toLowerCase());
    if (subjects.length && (!subject || !allowedSubjects.has(topic.subject.trim().toLowerCase()))) {
      throw new Error('The AI plan included a subject outside your saved learning profile.');
    }
    const day = Number.isInteger(topic.day) && topic.day >= 1 && topic.day <= 7 ? topic.day : index + 1;
    return {
      id: typeof topic.id === 'string' && /^[a-z0-9-]{1,60}$/i.test(topic.id)
        ? topic.id
        : `topic-${index + 1}`,
      title: topic.title.trim().slice(0, 120),
      subject: subject || topic.subject.trim().slice(0, 80),
      day,
      objective: topic.objective.trim().slice(0, 300),
      practice: topic.practice.trim().slice(0, 300),
      status: topic.status === 'completed' ? 'completed' : 'upcoming',
    };
  });
  return {
    title: value.title.trim().slice(0, 120),
    summary: value.summary.trim().slice(0, 500),
    topics,
  };
}

function preserveCompletedTopics(plan, previousPlan) {
  if (!previousPlan || !Array.isArray(previousPlan.topics)) return plan;
  const completed = new Set(previousPlan.topics
    .filter((topic) => topic.status === 'completed')
    .map((topic) => `${topic.subject.toLowerCase()}::${topic.title.toLowerCase()}`));
  return {
    ...plan,
    topics: plan.topics.map((topic) => ({
      ...topic,
      status: completed.has(`${topic.subject.toLowerCase()}::${topic.title.toLowerCase()}`)
        ? 'completed'
        : topic.status,
    })),
  };
}

function profileForPlan(user) {
  const subjects = Array.isArray(user.subjects) ? user.subjects : [];
  if (user.learnerType !== 'student' || (!user.classLevel && !user.universityCourse)) {
    const error = new Error('Complete your student class, course, and subject profile before generating a study plan.');
    error.status = 400;
    throw error;
  }
  return {
    learnerType: user.learnerType,
    educationLevel: user.educationLevel,
    classLevel: user.classLevel || '',
    subjects,
    universityCourse: user.universityCourse || '',
    universityYear: user.universityYear || null,
    secondaryTrack: user.secondaryTrack || null,
  };
}

async function signedInProfile(req) {
  const id = Number(req.user?.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    const error = new Error('Sign in again to access your study plan.');
    error.status = 401;
    throw error;
  }
  const user = await User.findByPk(id);
  if (!user) {
    const error = new Error('Your account could not be found. Please sign in again.');
    error.status = 404;
    throw error;
  }
  return { id, profile: profileForPlan(user) };
}

async function currentPlan(userId, transaction) {
  const [rows] = await sequelize.query(
    `SELECT plan, streak_count, last_study_date, updated_at
       FROM public.study_hub_study_plans
      WHERE user_id = :userId
      ${transaction ? 'FOR UPDATE' : ''}`,
    { replacements: { userId }, ...(transaction ? { transaction } : {}) },
  );
  return rows[0] || null;
}

function modelText(result) {
  return result.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim() || '';
}

async function createPlan(apiKey, profile, previousPlan = null, request = '') {
  const history = previousPlan ? JSON.stringify(previousPlan) : 'No plan exists yet.';
  const prompt = [
    'Create or revise a practical 7-day study plan for this learner.',
    `Learner profile: ${JSON.stringify(profile)}`,
    `Existing plan, if any: ${history}`,
    request ? `Learner's adjustment request: ${request}` : '',
    'Use only the listed subjects. If no subjects are listed, use the learner class/course to propose appropriate broad study topics and label the subject as General.',
    'Make each topic achievable in one 20-45 minute study session, with an objective and a concrete reading or practice task.',
    'Do not claim this is an official syllabus. Return JSON only with this shape:',
    '{"title":"...","summary":"...","topics":[{"id":"topic-1","title":"...","subject":"...","day":1,"objective":"...","practice":"...","status":"upcoming"}]}',
    'Return 5 to 7 topics, day values 1 through 7, and no markdown fences.',
  ].filter(Boolean).join('\n');
  const response = await generateContent(apiKey, {
    systemInstruction: { parts: [{ text: 'You are Study Hub’s adaptive study-planning tutor. Design encouraging, realistic learning plans for the supplied learner profile. Never infer mastery from profile details alone.' }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2_000, temperature: 0.35 },
  }, 45_000);
  if (!response.ok) {
    const error = new Error('Study Hub could not generate your plan right now. Please try again.');
    error.status = response.status === 429 || response.status === 503 ? 503 : 502;
    throw error;
  }
  const text = modelText(await response.json());
  if (!text) throw new Error('Study Hub returned an empty plan. Please try again.');
  return preserveCompletedTopics(normalisePlan(readModelJson(text), profile.subjects), previousPlan);
}

function failure(res, error, fallback) {
  if (error.name === 'TimeoutError' || error.name === 'AbortError') {
    return res.status(503).json({ error: 'The AI planner is taking longer than expected. Please try again.' });
  }
  if (error.status === 400 || error.status === 401 || error.status === 404 || error.status === 503) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(fallback, error instanceof Error ? error.name : 'Unknown error');
  return res.status(502).json({ error: error.message || fallback });
}

exports.getPlan = async (req, res) => {
  try {
    const { id } = await signedInProfile(req);
    const row = await currentPlan(id);
    const [activity] = await sequelize.query(
      `SELECT activity_date, completed_topics, reading_minutes
         FROM public.study_hub_study_activity
        WHERE user_id = :userId AND activity_date >= CURRENT_DATE - INTERVAL '6 days'
        ORDER BY activity_date ASC`,
      { replacements: { userId: id } },
    );
    return res.status(200).json({
      plan: row?.plan || null,
      streakCount: Number(row?.streak_count || 0),
      lastStudyDate: row?.last_study_date || null,
      activity,
    });
  } catch (error) {
    return failure(res, error, 'Your study plan could not be loaded.');
  }
};

exports.generatePlan = async (req, res) => {
  try {
    const { id, profile } = await signedInProfile(req);
    const existing = await currentPlan(id);
    if (existing) return res.status(200).json({ plan: existing.plan, streakCount: Number(existing.streak_count), created: false });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Study Hub AI planning is not configured yet.' });
    const plan = await createPlan(apiKey, profile);
    const [rows] = await sequelize.query(
      `INSERT INTO public.study_hub_study_plans (user_id, plan, streak_count, last_study_date)
       VALUES (:userId, CAST(:plan AS jsonb), 5, CURRENT_DATE)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING plan, streak_count`,
      { replacements: { userId: id, plan: JSON.stringify(plan) } },
    );
    const result = rows[0] || await currentPlan(id);
    return res.status(201).json({
      plan: result.plan,
      streakCount: Number(result.streak_count),
      created: Boolean(rows[0]),
    });
  } catch (error) {
    return failure(res, error, 'Your study plan could not be created.');
  }
};

exports.adjustPlan = async (req, res) => {
  try {
    const { id, profile } = await signedInProfile(req);
    const message = req.body?.message;
    if (typeof message !== 'string' || !message.trim() || message.length > MAX_CHAT_LENGTH) {
      return res.status(400).json({ error: `Enter a plan adjustment of no more than ${MAX_CHAT_LENGTH} characters.` });
    }
    const existing = await currentPlan(id);
    if (!existing) return res.status(404).json({ error: 'Create your study plan before asking to adjust it.' });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Study Hub AI planning is not configured yet.' });
    const plan = await createPlan(apiKey, profile, existing.plan, message.trim());
    await sequelize.query(
      `UPDATE public.study_hub_study_plans
          SET plan = CAST(:plan AS jsonb), updated_at = CURRENT_TIMESTAMP
        WHERE user_id = :userId`,
      { replacements: { userId: id, plan: JSON.stringify(plan) } },
    );
    return res.status(200).json({ plan, message: 'Your plan has been updated.' });
  } catch (error) {
    return failure(res, error, 'Your study plan could not be adjusted.');
  }
};

exports.completeTopic = async (req, res) => {
  let transaction;
  try {
    const { id } = await signedInProfile(req);
    const topicId = req.body?.topicId;
    if (typeof topicId !== 'string' || !/^[a-z0-9-]{1,60}$/i.test(topicId)) {
      return res.status(400).json({ error: 'Choose a valid study topic to mark complete.' });
    }
    transaction = await sequelize.transaction();
    const existing = await currentPlan(id, transaction);
    if (!existing) {
      await transaction.rollback();
      transaction = null;
      return res.status(404).json({ error: 'Create a study plan before tracking progress.' });
    }
    const topic = existing.plan.topics.find((item) => item.id === topicId);
    if (!topic) {
      await transaction.rollback();
      transaction = null;
      return res.status(404).json({ error: 'That topic is no longer in your study plan.' });
    }
    if (topic.status !== 'completed') {
      topic.status = 'completed';
      const [dateRows] = await sequelize.query(
        `SELECT CURRENT_DATE::text AS today, (CURRENT_DATE - 1)::text AS yesterday`,
        { transaction },
      );
      const previousDate = existing.last_study_date
        ? new Date(existing.last_study_date).toISOString().slice(0, 10)
        : '';
      const streak = previousDate === dateRows[0].today
        ? Number(existing.streak_count)
        : previousDate === dateRows[0].yesterday ? Number(existing.streak_count) + 1 : 1;
      await sequelize.query(
        `UPDATE public.study_hub_study_plans
            SET plan = CAST(:plan AS jsonb), streak_count = :streak, last_study_date = CURRENT_DATE,
                updated_at = CURRENT_TIMESTAMP
          WHERE user_id = :userId`,
        { replacements: { userId: id, plan: JSON.stringify(existing.plan), streak }, transaction },
      );
      await sequelize.query(
        `INSERT INTO public.study_hub_study_activity (user_id, activity_date, completed_topics, reading_minutes)
         VALUES (:userId, CURRENT_DATE, 1, 20)
         ON CONFLICT (user_id, activity_date) DO UPDATE
           SET completed_topics = public.study_hub_study_activity.completed_topics + 1,
               reading_minutes = public.study_hub_study_activity.reading_minutes + 20`,
        { replacements: { userId: id }, transaction },
      );
    }
    await transaction.commit();
    transaction = null;
    const row = await currentPlan(id);
    const [activity] = await sequelize.query(
      `SELECT activity_date, completed_topics, reading_minutes
         FROM public.study_hub_study_activity
        WHERE user_id = :userId AND activity_date >= CURRENT_DATE - INTERVAL '6 days'
        ORDER BY activity_date ASC`,
      { replacements: { userId: id } },
    );
    return res.status(200).json({ plan: row.plan, streakCount: Number(row.streak_count), activity });
  } catch (error) {
    if (transaction) await transaction.rollback();
    return failure(res, error, 'Study progress could not be updated.');
  }
};

exports.recommendResources = async (req, res) => {
  try {
    const { id, profile } = await signedInProfile(req);
    const existing = await currentPlan(id);
    if (!existing) return res.status(404).json({ error: 'Create your study plan before requesting resource recommendations.' });
    const candidates = req.body?.candidates;
    if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > MAX_CANDIDATES
      || candidates.some((item) => !item || typeof item.id !== 'string' || item.id.length > 500
        || typeof item.title !== 'string' || item.title.length > 200
        || typeof item.subject !== 'string' || item.subject.length > 80
        || typeof item.type !== 'string' || item.type.length > 80)) {
      return res.status(400).json({ error: `Provide between 1 and ${MAX_CANDIDATES} valid library resources.` });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Study Hub resource recommendations are not configured yet.' });
    const [memoryRows] = await sequelize.query(
      `SELECT topic FROM public.study_hub_ai_memories
        WHERE user_id = :userId ORDER BY created_at DESC LIMIT 8`,
      { replacements: { userId: id } },
    );
    const model = process.env.STUDY_RESOURCE_GEMINI_MODEL?.trim()
      || process.env.GEMINI_FALLBACK_MODEL?.trim()
      || 'gemini-3.5-flash';
    const response = await generateContentWithModel(apiKey, {
      systemInstruction: { parts: [{ text: 'You are Study Hub’s library resource curator. Recommend only candidate IDs provided by the learner’s class-and-subject-filtered library. Prioritize resources aligned with the next incomplete plan topics and the learner’s recent study interests. Never claim to know resource contents from a title alone. Return JSON only: {"recommendations":[{"id":"exact candidate id","reason":"short relevance explanation"}]}. Select at most 5.' }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify({
        learner: profile,
        plan: existing.plan,
        recentStudyTopics: memoryRows.map((row) => row.topic),
        learnerProgress: existing.plan.topics.map((item) => ({ subject: item.subject, title: item.title, status: item.status })),
        libraryCandidates: candidates.map(({ id: candidateId, title, subject, type }) => ({ id: candidateId, title, subject, type })),
      }) }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 800, temperature: 0.15 },
    }, model);
    if (!response.ok) {
      const error = new Error('Study Hub could not find resource recommendations right now.');
      error.status = response.status === 429 || response.status === 503 ? 503 : 502;
      throw error;
    }
    const result = readModelJson(modelText(await response.json()));
    const byId = new Map(candidates.map((item) => [item.id, item]));
    const recommendations = Array.isArray(result.recommendations)
      ? result.recommendations.filter((item) => item && byId.has(item.id)).slice(0, 5).map((item) => ({
        id: item.id,
        reason: typeof item.reason === 'string' ? item.reason.trim().slice(0, 200) : 'Relevant to your current study plan.',
      }))
      : [];
    return res.status(200).json({ recommendations });
  } catch (error) {
    return failure(res, error, 'Resource recommendations could not be loaded.');
  }
};
