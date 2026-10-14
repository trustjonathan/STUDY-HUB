// Topic list that powers the AI study-guide engine.
// Each entry becomes a static route at /STUDY-HUB/learn/<slug>.
// The page shell is generated at build time; the guide text is produced
// on demand by the backend Gemini endpoint when a learner opens the page.

export interface LessonTopic {
  slug: string;
  title: string;
  subject: string;
}

export const lessonTopics: LessonTopic[] = [
  { slug: 'cell-division', title: 'Cell Division', subject: 'Biology' },
  { slug: 'photosynthesis', title: 'Photosynthesis', subject: 'Biology' },
  { slug: 'respiration', title: 'Respiration', subject: 'Biology' },
  { slug: 'genetics', title: 'Genetics', subject: 'Biology' },
  { slug: 'enzymes', title: 'Enzymes', subject: 'Biology' },
  { slug: 'ecology', title: 'Ecology', subject: 'Biology' },
  { slug: 'chemical-bonding', title: 'Chemical Bonding', subject: 'Chemistry' },
  { slug: 'mole-concept', title: 'The Mole Concept', subject: 'Chemistry' },
  { slug: 'acids-and-bases', title: 'Acids and Bases', subject: 'Chemistry' },
  { slug: 'organic-chemistry', title: 'Introduction to Organic Chemistry', subject: 'Chemistry' },
  { slug: 'electrochemistry', title: 'Electrochemistry', subject: 'Chemistry' },
  { slug: 'trigonometry', title: 'Trigonometry', subject: 'Mathematics' },
  { slug: 'calculus', title: 'Calculus', subject: 'Mathematics' },
  { slug: 'probability', title: 'Probability', subject: 'Mathematics' },
  { slug: 'matrices', title: 'Matrices and Transformations', subject: 'Mathematics' },
  { slug: 'vectors', title: 'Vectors', subject: 'Mathematics' },
  { slug: 'newtons-laws-of-motion', title: "Newton's Laws of Motion", subject: 'Physics' },
  { slug: 'electric-circuits', title: 'Electric Circuits', subject: 'Physics' },
  { slug: 'waves', title: 'Waves', subject: 'Physics' },
  { slug: 'thermodynamics', title: 'Thermodynamics', subject: 'Physics' }
];

export function findTopic(slug: string): LessonTopic | undefined {
  return lessonTopics.find((topic) => topic.slug === slug);
}
