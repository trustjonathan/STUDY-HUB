export const libraryClassGroups = [
  { group: 'Early Childhood', items: [
    { label: 'Baby Class', keys: ['baby'] },
    { label: 'Top Class', keys: ['top'] },
    { label: 'Middle Class', keys: ['middle'] },
  ] },
  { group: 'Primary', items: [
    { label: 'P.1', keys: ['p1'] }, { label: 'P.2', keys: ['p2'] }, { label: 'P.3', keys: ['p3'] },
    { label: 'P.4', keys: ['p4'] }, { label: 'P.5', keys: ['p5'] }, { label: 'P.6', keys: ['p6'] },
    { label: 'P.7', keys: ['p7'] },
  ] },
  { group: 'O-Level (Lower Secondary)', items: [
    { label: 'S.1', keys: ['s1'] }, { label: 'S.2', keys: ['s2'] }, { label: 'S.3', keys: ['s3'] }, { label: 'S.4', keys: ['s4'] },
  ] },
  { group: 'A-Level (Upper Secondary)', items: [
    { label: 'S.5', keys: ['s5'] }, { label: 'S.6', keys: ['s6'] },
  ] },
];

export const libraryClasses = libraryClassGroups.flatMap((group) => group.items);
