const allowedClasses = [
  'Baby Class', 'Top Class', 'Middle Class',
  'P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6', 'P.7',
  'S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'
];

const allowedSubjects = ['Biology', 'Chemistry', 'Mathematics', 'Physics'];

module.exports = {
  allowedClasses,
  allowedSubjects,
  allowedClassSet: new Set(allowedClasses),
  allowedSubjectSet: new Set(allowedSubjects)
};
