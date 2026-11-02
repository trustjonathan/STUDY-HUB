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
  { slug: 'thermodynamics', title: 'Thermodynamics', subject: 'Physics' },
  { slug: 'cell-structure', title: 'Cell Structure', subject: 'Biology' },
  { slug: 'human-digestion', title: 'Human Digestion', subject: 'Biology' },
  { slug: 'transport-in-plants', title: 'Transport in Plants', subject: 'Biology' },
  { slug: 'reproduction-in-plants', title: 'Reproduction in Plants', subject: 'Biology' },
  { slug: 'classification-of-living-things', title: 'Classification of Living Things', subject: 'Biology' },
  { slug: 'atomic-structure', title: 'Atomic Structure', subject: 'Chemistry' },
  { slug: 'periodic-table', title: 'The Periodic Table', subject: 'Chemistry' },
  { slug: 'rates-of-reaction', title: 'Rates of Reaction', subject: 'Chemistry' },
  { slug: 'chemical-equilibrium', title: 'Chemical Equilibrium', subject: 'Chemistry' },
  { slug: 'electrolysis', title: 'Electrolysis', subject: 'Chemistry' },
  { slug: 'linear-equations', title: 'Linear Equations', subject: 'Mathematics' },
  { slug: 'quadratic-equations', title: 'Quadratic Equations', subject: 'Mathematics' },
  { slug: 'algebraic-expressions', title: 'Algebraic Expressions', subject: 'Mathematics' },
  { slug: 'sequences-and-series', title: 'Sequences and Series', subject: 'Mathematics' },
  { slug: 'statistics-and-data', title: 'Statistics and Data', subject: 'Mathematics' },
  { slug: 'motion-and-graphs', title: 'Motion and Motion Graphs', subject: 'Physics' },
  { slug: 'work-energy-and-power', title: 'Work, Energy and Power', subject: 'Physics' },
  { slug: 'pressure-in-fluids', title: 'Pressure in Fluids', subject: 'Physics' },
  { slug: 'magnetism', title: 'Magnetism', subject: 'Physics' },
  { slug: 'reflection-and-refraction', title: 'Reflection and Refraction', subject: 'Physics' },
  { slug: 'soil-formation-and-conservation', title: 'Soil Formation and Conservation', subject: 'Agriculture' },
  { slug: 'crop-production', title: 'Crop Production', subject: 'Agriculture' },
  { slug: 'livestock-management', title: 'Livestock Management', subject: 'Agriculture' },
  { slug: 'weather-and-climate', title: 'Weather and Climate', subject: 'Geography' },
  { slug: 'map-reading', title: 'Map Reading and Interpretation', subject: 'Geography' },
  { slug: 'population-and-settlement', title: 'Population and Settlement', subject: 'Geography' },
  { slug: 'industrial-revolution', title: 'The Industrial Revolution', subject: 'History' },
  { slug: 'east-african-independence', title: 'Independence in East Africa', subject: 'History' },
  { slug: 'historical-sources', title: 'Using Historical Sources', subject: 'History' },
  { slug: 'supply-and-demand', title: 'Supply and Demand', subject: 'Economics' },
  { slug: 'scarcity-and-choice', title: 'Scarcity and Choice', subject: 'Economics' },
  { slug: 'inflation-and-prices', title: 'Inflation and Prices', subject: 'Economics' },
  { slug: 'grammar-and-sentence-structure', title: 'Grammar and Sentence Structure', subject: 'English Language' },
  { slug: 'reading-comprehension', title: 'Reading Comprehension', subject: 'English Language' },
  { slug: 'writing-a-formal-letter', title: 'Writing a Formal Letter', subject: 'English Language' },
  { slug: 'computer-hardware-and-software', title: 'Computer Hardware and Software', subject: 'ICT' },
  { slug: 'internet-safety-and-digital-citizenship', title: 'Internet Safety and Digital Citizenship', subject: 'ICT' },
  { slug: 'spreadsheets-and-data', title: 'Spreadsheets and Data', subject: 'ICT' }
];

export function findTopic(slug: string): LessonTopic | undefined {
  return lessonTopics.find((topic) => topic.slug === slug);
}
