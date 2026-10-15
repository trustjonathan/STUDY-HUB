const allowedClasses = [
  'Baby Class', 'Top Class', 'Middle Class',
  'P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6', 'P.7',
  'S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'
];

const subjectCatalog = require('../../../frontend/src/data/subjects.json');
const allowedSubjects = subjectCatalog.map((subject) => subject.name);
const subjectLevels = new Map(subjectCatalog.map((subject) => [subject.name, subject.levels]));

function levelsForClass(classLevel) {
  const match = /^S\.([1-6])$/.exec(classLevel || '');
  if (!match) return null;
  return Number(match[1]) <= 4 ? ['O-Level'] : ['A-Level', 'Subsidiary'];
}

module.exports = {
  allowedClasses,
  allowedSubjects,
  allowedClassSet: new Set(allowedClasses),
  allowedSubjectSet: new Set(allowedSubjects),
  subjectLevels,
  levelsForClass
};
