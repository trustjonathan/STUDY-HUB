const path = require('node:path');
const githubResourceService = require('../../services/githubResourceService');

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.rtf', '.ppt', '.pptx', '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
]);
const ALLOWED_CLASS_KEYS = new Set([
  'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7',
  's1', 's2', 's3', 's4', 's5', 's6', 'unsorted',
]);
const ALLOWED_RESOURCE_TYPES = new Set([
  'Past Papers', 'Marking Guides', 'Schemes of Work', 'Holiday Package',
  'Lesson Notes', 'Study Resources',
]);

function sendServiceError(res, error, fallback) {
  console.error(fallback, error);
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 502;
  return res.status(statusCode).json({ error: error.message || fallback });
}

function cleanPathSegment(value, maxLength) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  if (
    !cleaned
    || cleaned.length > maxLength
    || cleaned === '.'
    || cleaned === '..'
    || /[\\/\u0000-\u001f\u007f]/.test(cleaned)
  ) return null;
  return cleaned;
}

function parseClassKeys(value) {
  if (typeof value !== 'string') return null;
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || !parsed.every((key) => typeof key === 'string' && ALLOWED_CLASS_KEYS.has(key))) {
    return null;
  }
  return [...new Set(parsed.length ? parsed : ['unsorted'])];
}

async function getCategories(req, res) {
  try {
    const categories = await githubResourceService.listCategories();
    return res.json({ categories });
  } catch (error) {
    return sendServiceError(res, error, 'Resource categories could not be loaded.');
  }
}

async function uploadResource(req, res) {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Choose a file to upload.' });

  const category = cleanPathSegment(req.body.category, 100);
  const year = cleanPathSegment(req.body.year || 'Undated', 7);
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const subject = typeof req.body.subject === 'string' ? req.body.subject.trim() : '';
  const type = typeof req.body.type === 'string' ? req.body.type.trim() : '';
  const classKeys = parseClassKeys(req.body.classKeys);
  const filename = cleanPathSegment(path.basename(file.originalname || ''), 180);
  const extension = path.extname(filename || '').toLowerCase();

  if (!category) return res.status(400).json({ error: 'Enter a valid category name.' });
  if (!year || !/^(?:19\d{2}|20\d{2}|Undated)$/.test(year)) {
    return res.status(400).json({ error: 'Choose a four-digit year or Undated.' });
  }
  if (!filename || !ALLOWED_EXTENSIONS.has(extension)) {
    return res.status(400).json({ error: 'This file type is not supported by the Study Hub reader.' });
  }
  if (!title || title.length > 200) return res.status(400).json({ error: 'Enter a title of at most 200 characters.' });
  if (!subject || subject.length > 80) return res.status(400).json({ error: 'Enter a subject of at most 80 characters.' });
  if (!ALLOWED_RESOURCE_TYPES.has(type)) return res.status(400).json({ error: 'Choose a valid resource type.' });
  if (!classKeys) return res.status(400).json({ error: 'Choose valid class levels.' });

  const filePath = `${category}/${year}/${filename}`;
  const resource = {
    title,
    filename,
    path: filePath,
    url: githubResourceService.resourceUrlForPath(filePath),
    category,
    body: category,
    year,
    classKeys,
    subject,
    type,
    extension: extension.slice(1),
  };

  try {
    const result = await githubResourceService.commitResource({
      filePath,
      fileBuffer: file.buffer,
      resource,
    });
    return res.status(201).json({
      success: true,
      message: 'Resource uploaded and added to the library catalog.',
      resource,
      commitSha: result.commitSha,
    });
  } catch (error) {
    return sendServiceError(res, error, 'The resource could not be committed to GitHub.');
  }
}

module.exports = {
  getCategories,
  uploadResource,
};
