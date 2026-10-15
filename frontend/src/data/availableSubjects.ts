import subjectCatalog from './subjects.json';

export const contentSubjectSlugs = [
  'mathematics',
  'chemistry',
  'biology',
  'physics',
] as const;

export const preferenceSubjects = subjectCatalog;

const contentSubjectSlugSet = new Set<string>(contentSubjectSlugs);

export const availableSubjects = subjectCatalog.filter((subject) =>
  contentSubjectSlugSet.has(subject.slug),
);

export const subjectsUnderDevelopment = subjectCatalog.filter((subject) =>
  !contentSubjectSlugSet.has(subject.slug),
);
