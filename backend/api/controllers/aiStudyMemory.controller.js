const memoryService = require('../../services/aiStudyMemory');

exports.exportMemory = async (req, res) => {
  try {
    const memories = await memoryService.exportStudyMemory(req.user.id);
    return res.status(200).json({
      exportedAt: new Date().toISOString(),
      memoryPolicy: 'Study topics and embeddings only; tutor responses and full transcripts are not stored.',
      memories,
    });
  } catch (error) {
    console.error('Learner AI memory export failed:', error instanceof Error ? error.name : 'Unknown error');
    return res.status(503).json({ error: 'Your AI study memory could not be exported right now.' });
  }
};

exports.deleteMemory = async (req, res) => {
  try {
    const deleted = await memoryService.deleteStudyMemory(req.user.id);
    return res.status(200).json({ deleted });
  } catch (error) {
    console.error('Learner AI memory deletion failed:', error instanceof Error ? error.name : 'Unknown error');
    return res.status(503).json({ error: 'Your AI study memory could not be deleted right now.' });
  }
};
