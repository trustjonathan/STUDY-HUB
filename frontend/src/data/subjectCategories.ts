export const subjectCategories = [
  {
    id: 'sciences-math',
    label: 'Sciences & Math',
    filterLabel: 'Sciences',
    description: 'Investigate the natural world and build quantitative reasoning.',
    preview: ['biology', 'chemistry', 'physics', 'mathematics']
  },
  {
    id: 'languages',
    label: 'Languages',
    filterLabel: 'Languages',
    description: 'Develop communication through local and international languages.',
    preview: ['english-language', 'kiswahili', 'literature-in-english', 'french']
  },
  {
    id: 'humanities-social',
    label: 'Humanities & Social',
    filterLabel: 'Humanities',
    description: 'Explore societies, belief, history, and economic choices.',
    preview: ['geography', 'history', 'cre', 'economics']
  },
  {
    id: 'applied-technical',
    label: 'Applied & Technical',
    filterLabel: 'Applied',
    description: 'Build practical, creative, digital, and technical skills.',
    preview: ['ict', 'agriculture', 'entrepreneurship', 'technology-and-design']
  }
] as const;

export type SubjectCategoryId = typeof subjectCategories[number]['id'];