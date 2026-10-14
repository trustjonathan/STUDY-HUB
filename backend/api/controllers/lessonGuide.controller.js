const MAX_TOPIC_LENGTH = 300;
const { generateContent } = require('../../services/geminiService');
const { allowedClassSet, allowedSubjectSet } = require('../constants/learningProfile');

function invalidRequest(res, message) {
  return res.status(400).json({ error: message });
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// GitHub auto-commit config (all optional — the guide still works without it).
function githubConfig() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) return null;
  const branch = process.env.GITHUB_BRANCH || 'main';
  const notesPath = (process.env.GITHUB_NOTES_PATH || 'src/content/notes').replace(/^\/+|\/+$/g, '');
  return { token, owner, repo, branch, notesPath };
}

function githubHeaders(config) {
  return {
    Authorization: `Bearer ${config.token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'study-hub-lesson-bot',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

// Returns the stored markdown if the note already exists in the repo, else null.
async function readNoteFromGithub(config, slug) {
  const path = `${config.notesPath}/${slug}.md`;
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`;
  const response = await fetch(url, { headers: githubHeaders(config) });
  if (response.status === 404) return null;
  if (!response.ok) {
    console.error(`GitHub note lookup failed with HTTP ${response.status}.`);
    return null;
  }
  const data = await response.json();
  if (typeof data.content !== 'string') return null;
  return Buffer.from(data.content, 'base64').toString('utf8');
}

// Commits the note to the repo. Throws on failure so the caller can still serve
// the freshly generated content even if the commit does not succeed.
async function writeNoteToGithub(config, slug, markdown) {
  const path = `${config.notesPath}/${slug}.md`;
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
  const body = {
    message: `feat(notes): auto-generate study guide for ${slug}`,
    content: Buffer.from(markdown, 'utf8').toString('base64'),
    branch: config.branch
  };
  const response = await fetch(url, {
    method: 'PUT',
    headers: githubHeaders(config),
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`GitHub commit failed with HTTP ${response.status}. ${detail}`);
  }
}

async function generateWithGemini(apiKey, topic, learningProfile) {
  const profileInstruction = learningProfile
    ? ` The learner is studying ${learningProfile.classLevel || 'an unspecified class level'} and has selected these subjects: ${learningProfile.subjects.join(', ') || 'no preferred subjects yet'}. Tailor explanations, examples, and suggested next steps to this level and these subjects when relevant. Do not claim the learner studies a subject that is not listed.`
    : '';
  const geminiResponse = await generateContent(apiKey, {
      systemInstruction: {
        parts: [{
          text: `You are Study Hub's academic tutor for Ugandan learners. Answer the learner's academic question directly and accurately. Explain difficult ideas in clear language, show working for calculations, and use a short example when it helps. If the learner gives only a topic, provide a concise, exam-focused mini study guide with useful Markdown headings and bullet points. If a request is clearly unrelated to learning or education, politely decline and invite the learner to ask an academic question. Do not invent facts; say when you are unsure. Frame curriculum points as general study help, not official NCDC or UNEB rulings.${profileInstruction}`
        }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: topic }]
      }],
      generationConfig: { maxOutputTokens: 1800, temperature: 0.35 }
  });

  if (!geminiResponse.ok) {
    console.error(`Gemini study response failed with HTTP ${geminiResponse.status}.`);
    const busy = geminiResponse.status === 429 || geminiResponse.status === 503;
    const error = new Error(
      busy
        ? 'Study Hub AI is experiencing high demand. Please try again shortly.'
        : 'The study guide could not be generated right now.'
    );
    error.status = busy ? 503 : 502;
    throw error;
  }

  const result = await geminiResponse.json();
  const markdown = result.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  if (!markdown) {
    const error = new Error('The study guide came back empty. Please try again.');
    error.status = 502;
    throw error;
  }
  return markdown;
}

const REFUSAL_MESSAGE =
  'I can only generate study notes for academic and educational subjects — like the sciences, mathematics, agriculture, computing, economics, and humanities. Please ask a study-related question!';

const ACADEMIC_GUARDRAIL_INSTRUCTION =
  'You are a strict subject classifier for an educational study-notes service. ' +
  'Given a topic, decide whether it is an academic/educational subject suitable for a study guide ' +
  '(e.g. Biology, Chemistry, Physics, Mathematics, Agriculture, Computer Science, Economics, History, ' +
  'Geography, languages, or general school/university subjects). ' +
  'Reply with exactly one word: YES if it is academic/educational, or NO for casual chat, entertainment, ' +
  'hacking, gaming, unrelated chit-chat, or anything inappropriate. Output nothing else.';

// Fast guardrail: returns true only for academic/educational topics.
async function isAcademic(apiKey, topic) {
  const response = await generateContent(apiKey, {
    systemInstruction: { parts: [{ text: ACADEMIC_GUARDRAIL_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: `Topic: "${topic}"` }] }],
    generationConfig: { maxOutputTokens: 8, temperature: 0 }
  });
  if (!response.ok) {
    console.error(`Gemini topic check failed with HTTP ${response.status}.`);
    const busy = response.status === 429 || response.status === 503;
    const error = new Error(busy
      ? 'Study Hub AI is experiencing high demand. Please try again shortly.'
      : 'The topic check is unavailable right now. Please try again.');
    error.status = busy ? 503 : 502;
    throw error;
  }
  const result = await response.json();
  const text = (result.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '')
    .replace(/[^A-Za-z]/g, ' ')
    .trim()
    .split(/\s+/)[0]
    ?.toUpperCase();
  return text !== 'NO';
}

function titleFromSlug(slug) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function listNotesFromGithub(config) {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.notesPath}?ref=${config.branch}`;
  const response = await fetch(url, { headers: githubHeaders(config) });
  if (!response.ok) return [];
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data
    .filter((item) => item.type === 'file' && item.name.endsWith('.md'))
    .map((item) => item.name.replace(/\.md$/, ''));
}

// GET / — list generated notes for the Recents sidebar.
exports.listHandler = async (req, res) => {
  const github = githubConfig();
  let slugs = [];
  if (github) {
    try {
      slugs = await listNotesFromGithub(github);
    } catch (error) {
      console.error('GitHub notes list error:', error instanceof Error ? error.message : error);
    }
  }
  return res.status(200).json({ notes: slugs.map((slug) => ({ slug, title: titleFromSlug(slug) })) });
};

exports.handler = async (req, res) => {
  const { topic, learningProfile: requestedProfile } = req.body || {};

  if (typeof topic !== 'string' || !topic.trim()) {
    return invalidRequest(res, 'A topic is required.');
  }
  let learningProfile = null;
  if (requestedProfile !== undefined) {
    if (!requestedProfile || typeof requestedProfile !== 'object' || Array.isArray(requestedProfile)) {
      return invalidRequest(res, 'Learning preferences must be an object.');
    }
    const { classLevel, subjects } = requestedProfile;
    if ((classLevel !== null && classLevel !== '' && !allowedClassSet.has(classLevel))
      || !Array.isArray(subjects)
      || subjects.length > allowedSubjectSet.size
      || new Set(subjects).size !== subjects.length
      || subjects.some((subject) => !allowedSubjectSet.has(subject))) {
      return invalidRequest(res, 'Learning preferences must use an available class and subject.');
    }
    learningProfile = { classLevel: classLevel || '', subjects };
  }
  const hasPersonalPreferences = Boolean(learningProfile && (learningProfile.classLevel || learningProfile.subjects.length));
  const cleanTopic = topic.trim();
  if (cleanTopic.length > MAX_TOPIC_LENGTH) {
    return invalidRequest(res, `Keep your question under ${MAX_TOPIC_LENGTH} characters.`);
  }
  const slug = slugify(cleanTopic);
  if (!slug) {
    return invalidRequest(res, 'That topic could not be turned into a valid page name.');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Lesson guide request rejected: GEMINI_API_KEY is not configured.');
    return res.status(503).json({ error: 'The AI study guides are not configured yet.' });
  }

  const github = githubConfig();

  // 1. Serve instantly from the repo if this guide was generated before.
  if (github && !hasPersonalPreferences) {
    try {
      const existing = await readNoteFromGithub(github, slug);
      if (existing && existing.trim()) {
        return res.status(200).json({ topic: cleanTopic, slug, markdown: existing, source: 'cache' });
      }
    } catch (error) {
      console.error('GitHub note lookup error:', error instanceof Error ? error.message : error);
    }
  }

  // 2. Academic guardrail: only generate/commit genuinely educational topics.
  //    (Already-approved notes were served above from cache, so this gates new work.)
  try {
    const academic = await isAcademic(apiKey, cleanTopic);
    if (!academic) {
      return res.status(200).json({ refused: true, message: REFUSAL_MESSAGE });
    }
  } catch (error) {
    const status = error.status || 502;
    console.error('Academic guardrail error:', error instanceof Error ? error.message : error);
    return res.status(status).json({ error: error.message });
  }

  // 3. Generate a fresh guide with Gemini.
  let markdown;
  try {
    markdown = await generateWithGemini(apiKey, cleanTopic, learningProfile);
  } catch (error) {
    const status = error.status || 502;
    if (status !== 429 && status !== 502) console.error('Gemini generation error:', error);
    return res.status(status).json({ error: error.message });
  }

  // 3. Persist it to GitHub so future visits are instant and it survives forever.
  let committed = false;
  if (github && !hasPersonalPreferences) {
    try {
      await writeNoteToGithub(github, slug, markdown);
      committed = true;
    } catch (error) {
      console.error('GitHub note commit error:', error instanceof Error ? error.message : error);
    }
  }

  return res.status(200).json({
    topic: cleanTopic,
    slug,
    markdown,
    source: hasPersonalPreferences ? 'personalized-unsaved' : committed ? 'generated' : 'generated-unsaved'
  });
};
