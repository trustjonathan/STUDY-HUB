import { useState, type SubmitEvent } from 'react';
import { preferenceSubjects } from '../data/availableSubjects';
import { libraryClasses } from '../data/libraryClasses';
import '../styles/learning-preferences.css';

export interface LearningPreferences {
  learnerType: 'student' | 'non-student';
  educationLevel: 'university' | 'secondary' | 'primary' | 'nursery' | null;
  universityCourse: string;
  universityYear: number | null;
  secondaryTrack: 'O-Level' | 'A-Level' | null;
  classLevel: string | null;
  subjects: string[];
}

interface Props {
  initialLearnerType?: 'student' | 'non-student' | null;
  initialEducationLevel?: 'university' | 'secondary' | 'primary' | 'nursery' | null;
  initialUniversityCourse?: string | null;
  initialUniversityYear?: number | null;
  initialSecondaryTrack?: 'O-Level' | 'A-Level' | null;
  initialClassLevel: string;
  initialSubjects: string[];
  submitLabel: string;
  onSave: (preferences: LearningPreferences) => Promise<void>;
  onSkip?: () => Promise<void>;
}

function levelsForClass(classLevel: string): readonly string[] | null {
  const selectedClass = libraryClasses.find((item) => item.label === classLevel);
  const classKey = selectedClass?.keys[0] || '';
  if (!/^s[1-6]$/.test(classKey)) return null;
  return Number(classKey.slice(1)) <= 4 ? ['O-Level'] : ['A-Level', 'Subsidiary'];
}

function subjectsForClass(classLevel: string) {
  const levels = levelsForClass(classLevel);
  return levels
    ? preferenceSubjects.filter((subject) => subject.levels.some((level) => levels.includes(level)))
    : preferenceSubjects;
}

function inferEducationLevel(classLevel: string): Props['initialEducationLevel'] {
  if (/^S\./.test(classLevel)) return 'secondary';
  if (/^P\./.test(classLevel)) return 'primary';
  if (['Baby Class', 'Top Class', 'Middle Class'].includes(classLevel)) return 'nursery';
  return null;
}

export default function LearningPreferencesForm({
  initialLearnerType = null,
  initialEducationLevel = null,
  initialUniversityCourse = '',
  initialUniversityYear = null,
  initialSecondaryTrack = null,
  initialClassLevel,
  initialSubjects,
  submitLabel,
  onSave,
  onSkip,
}: Props) {
  const initialClassTrack = /^S\.[1-4]$/.test(initialClassLevel) ? 'O-Level' : /^S\.[5-6]$/.test(initialClassLevel) ? 'A-Level' : null;
  const [learnerType, setLearnerType] = useState<'student' | 'non-student'>(initialLearnerType || 'student');
  const [educationLevel, setEducationLevel] = useState<'university' | 'secondary' | 'primary' | 'nursery' | ''>(
    initialEducationLevel || inferEducationLevel(initialClassLevel) || '',
  );
  const [universityCourse, setUniversityCourse] = useState(initialUniversityCourse || '');
  const [universityYear, setUniversityYear] = useState(initialUniversityYear ? String(initialUniversityYear) : '');
  const [secondaryTrack, setSecondaryTrack] = useState<'O-Level' | 'A-Level' | ''>(initialSecondaryTrack || initialClassTrack || '');
  const [classLevel, setClassLevel] = useState(initialClassLevel);
  const [subjects, setSubjects] = useState(() => {
    const eligibleSubjects = new Set(subjectsForClass(initialClassLevel).map((subject) => subject.name));
    return initialSubjects.filter((subject) => eligibleSubjects.has(subject));
  });
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<'save' | 'skip' | null>(null);
  const [error, setError] = useState('');
  const filteredSubjects = subjectsForClass(classLevel);
  const availableClasses = educationLevel === 'nursery'
    ? libraryClasses.filter((item) => ['Baby Class', 'Top Class', 'Middle Class'].includes(item.label))
    : educationLevel === 'primary'
      ? libraryClasses.filter((item) => /^P\./.test(item.label))
      : educationLevel === 'secondary' && secondaryTrack === 'O-Level'
        ? libraryClasses.filter((item) => /^S\.[1-4]$/.test(item.label))
        : educationLevel === 'secondary' && secondaryTrack === 'A-Level'
          ? libraryClasses.filter((item) => /^S\.[5-6]$/.test(item.label))
          : [];

  function toggleSubject(subject: string) {
    setSubjects((current) => current.includes(subject)
      ? current.filter((item) => item !== subject)
      : [...current, subject]);
  }

  function changeEducationLevel(nextLevel: 'university' | 'secondary' | 'primary' | 'nursery' | '') {
    setEducationLevel(nextLevel);
    setClassLevel('');
    setSubjects([]);
    setSecondaryTrack('');
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (learnerType === 'student' && !educationLevel) {
      setError('Choose your current education level to continue.');
      return;
    }
    if (learnerType === 'student' && educationLevel === 'university' && !universityCourse.trim()) {
      setError('Enter your university course or programme.');
      return;
    }
    if (learnerType === 'student' && educationLevel === 'university' && !universityYear) {
      setError('Choose your current university year.');
      return;
    }
    if (learnerType === 'student' && educationLevel === 'secondary' && !secondaryTrack) {
      setError('Choose O-Level or A-Level.');
      return;
    }
    if (learnerType === 'student' && educationLevel !== 'university' && !classLevel) {
      setError('Choose your current class.');
      return;
    }
    if (learnerType === 'student' && educationLevel === 'secondary' && !subjects.length) {
      setError('Choose at least one subject.');
      return;
    }

    setBusy(true);
    setBusyAction('save');
    setError('');
    try {
      await onSave({
        learnerType,
        educationLevel: learnerType === 'student' ? educationLevel || null : null,
        universityCourse: learnerType === 'student' && educationLevel === 'university' ? universityCourse.trim() : '',
        universityYear: learnerType === 'student' && educationLevel === 'university' ? Number(universityYear) : null,
        secondaryTrack: learnerType === 'student' && educationLevel === 'secondary' ? secondaryTrack || null : null,
        classLevel: learnerType === 'student' && educationLevel !== 'university' ? classLevel || null : null,
        subjects: learnerType === 'student' ? subjects : [],
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your learning profile.');
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  async function skip() {
    if (!onSkip || busy) return;
    setBusy(true);
    setBusyAction('skip');
    setError('');
    try {
      await onSkip();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not skip profile setup.');
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  return (
    <form className="learning-preferences-form" onSubmit={submit} aria-busy={busy}>
      <fieldset className="learning-subject-field">
        <legend>Which best describes you?</legend>
        <div className="learning-choice-options">
          {([
            ['student', 'I am a student'],
            ['non-student', 'I am not a student'],
          ] as const).map(([value, label]) => (
            <label key={value} className={`learning-choice-option ${learnerType === value ? 'is-selected' : ''}`}>
              <input type="radio" name="learnerType" value={value} checked={learnerType === value} onChange={() => setLearnerType(value)} disabled={busy} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {learnerType === 'student' && (
        <>
          <label className="learning-class-field">
            Your education level
            <select value={educationLevel} onChange={(event) => changeEducationLevel(event.target.value as 'university' | 'secondary' | 'primary' | 'nursery' | '')} disabled={busy}>
              <option value="">Choose an education level</option>
              <option value="university">University</option>
              <option value="secondary">Secondary</option>
              <option value="primary">Primary</option>
              <option value="nursery">Nursery</option>
            </select>
          </label>

          {educationLevel === 'university' && (
            <div className="learning-conditional-fields">
              <label className="learning-class-field">
                Course or programme
                <input type="text" value={universityCourse} onChange={(event) => setUniversityCourse(event.target.value)} maxLength={160} placeholder="e.g. Bachelor of Science in Biology" disabled={busy} />
              </label>
              <label className="learning-class-field">
                Current year
                <select value={universityYear} onChange={(event) => setUniversityYear(event.target.value)} disabled={busy}>
                  <option value="">Choose your year</option>
                  {Array.from({ length: 8 }, (_, index) => <option key={index + 1} value={index + 1}>Year {index + 1}</option>)}
                </select>
              </label>
            </div>
          )}

          {educationLevel === 'secondary' && (
            <label className="learning-class-field">
              Secondary programme
              <select
                value={secondaryTrack}
                onChange={(event) => {
                  const nextTrack = event.target.value as 'O-Level' | 'A-Level' | '';
                  setSecondaryTrack(nextTrack);
                  setClassLevel('');
                  setSubjects([]);
                }}
                disabled={busy}
              >
                <option value="">Choose O-Level or A-Level</option>
                <option value="O-Level">O-Level</option>
                <option value="A-Level">A-Level</option>
              </select>
            </label>
          )}

          {educationLevel !== '' && educationLevel !== 'university' && (
            <label className="learning-class-field">
              {educationLevel === 'secondary' ? `${secondaryTrack || 'Secondary'} class` : educationLevel === 'primary' ? 'Primary class' : 'Nursery class'}
              <select
                value={classLevel}
                onChange={(event) => {
                  const nextClassLevel = event.target.value;
                  const eligibleSubjects = new Set(subjectsForClass(nextClassLevel).map((subject) => subject.name));
                  setClassLevel(nextClassLevel);
                  setSubjects((current) => current.filter((subject) => eligibleSubjects.has(subject)));
                }}
                disabled={busy || (educationLevel === 'secondary' && !secondaryTrack)}
              >
                <option value="">Choose your class</option>
                {availableClasses.map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}
              </select>
            </label>
          )}

          {educationLevel !== '' && educationLevel !== 'university' && (
            <fieldset className="learning-subject-field">
              <legend>{educationLevel === 'secondary' ? 'Your subjects' : 'Subjects (optional)'}</legend>
              <p>{educationLevel === 'secondary' ? `Choose subjects available at ${secondaryTrack || 'your level'}.` : 'Add subjects if you would like the tutor to focus on particular topics.'}</p>
              <div className="learning-subject-options">
                {filteredSubjects.map((subject) => (
                  <label key={subject.slug} className={`learning-subject-option ${subjects.includes(subject.name) ? 'is-selected' : ''}`}>
                    <input type="checkbox" value={subject.name} checked={subjects.includes(subject.name)} onChange={() => toggleSubject(subject.name)} disabled={busy} />
                    <span>{subject.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </>
      )}

      {error && <p className="learning-preferences-error" role="alert">{error}</p>}
      {busy && <p className="learning-preferences-progress" role="status">{busyAction === 'skip' ? 'Updating your profile…' : 'Saving your learning profile…'}</p>}
      <div className="learning-preferences-actions">
        {onSkip && <button className="learning-preferences-skip" type="button" onClick={() => void skip()} disabled={busy}>{busyAction === 'skip' ? 'Skipping…' : 'Skip for now'}</button>}
        <button className="learning-preferences-submit" type="submit" disabled={busy}>
          {busy ? busyAction === 'skip' ? 'Please wait…' : 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
