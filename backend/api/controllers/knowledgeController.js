const User = require('../../database/models/postgres/user');
const Notes = require('../../database/models/postgres/notes');
const Flashcard = require('../../database/models/postgres/flashcard');
const Quiz = require('../../database/models/postgres/quiz');
const Timetable = require('../../database/models/postgres/timetable');
const Assignment = require('../../database/models/postgres/assignment');
const { generateAIStudyPlan } = require('../../services/ai/recommendation');

// ----------------------
// Fetch user notes
// ----------------------
exports.getNotes = async (req, res) => {
  try {
    const notes = await Notes.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    res.json({ notes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// Create or update a note
// ----------------------
exports.saveNote = async (req, res) => {
  try {
    const { title, content, noteId } = req.body;

    let note;
    if (noteId) {
      note = await Notes.update({ title, content }, { where: { id: noteId, userId: req.user.id }, returning: true });
    } else {
      note = await Notes.create({ title, content, userId: req.user.id });
    }

    res.status(201).json({ message: 'Note saved', note });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// Fetch flashcards
// ----------------------
exports.getFlashcards = async (req, res) => {
  try {
    const flashcards = await Flashcard.findAll({ where: { userId: req.user.id } });
    res.json({ flashcards });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// Create a quiz
// ----------------------
exports.createQuiz = async (req, res) => {
  try {
    const { title, questions } = req.body;

    const quiz = await Quiz.create({ title, questions, userId: req.user.id });
    res.status(201).json({ message: 'Quiz created', quiz });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// Generate AI Study Plan
// ----------------------
exports.generateStudyPlan = async (req, res) => {
  try {
    const { subjects, goals } = req.body;

    // AI service generates a personalized learning plan
    const plan = await generateAIStudyPlan(req.user.id, subjects, goals);

    res.json({ message: 'Study plan generated', plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// Get timetable
// ----------------------
exports.getTimetable = async (req, res) => {
  try {
    const timetable = await Timetable.findAll({ where: { userId: req.user.id }, order: [['day', 'ASC']] });
    res.json({ timetable });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// Submit assignment
// ----------------------
exports.submitAssignment = async (req, res) => {
  try {
    const { assignmentId, content, attachments } = req.body;

    const submission = await Assignment.create({
      assignmentId,
      userId: req.user.id,
      content,
      attachments
    });

    res.status(201).json({ message: 'Assignment submitted', submission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};