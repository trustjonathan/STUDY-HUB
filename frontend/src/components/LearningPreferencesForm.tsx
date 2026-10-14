import { useState, type SubmitEvent } from 'react';
import { availableSubjects } from '../data/availableSubjects';
import { libraryClasses } from '../data/libraryClasses';
import '../styles/learning-preferences.css';

export interface LearningPreferences {
  classLevel: string;
  subjects: string[];
}

interface Props {
  initialClassLevel: string;
  initialSubjects: string[];
  submitLabel: string;
  onSave: (preferences: LearningPreferences) => Promise<void>;
  onSkip?: () => Promise<void>;
}

export default function LearningPreferencesForm({
  initialClassLevel,
  initialSubjects,
  submitLabel,
  onSave,
  onSkip,
}: Props) {
  const [classLevel, setClassLevel] = useState(initialClassLevel);
  const [subjects, setSubjects] = useState(initialSubjects);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function toggleSubject(subject: string) {
    setSubjects((current) => current.includes(subject)
      ? current.filter((item) => item !== subject)
      : [...current, subject]);
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!classLevel) {
      setError('Choose your current class or level to continue.');
      return;
    }
    if (!subjects.length) {
      setError('Choose at least one subject to continue.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await onSave({ classLevel, subjects });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your learning profile.');
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    if (!onSkip || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSkip();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not skip profile setup.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="learning-preferences-form" onSubmit={submit}>
      <label className="learning-class-field">
        Your class or level
        <select value={classLevel} onChange={(event) => setClassLevel(event.target.value)} disabled={busy}>
          <option value="">Choose a class</option>
          {libraryClasses.map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}
        </select>
      </label>
      <fieldset className="learning-subject-field">
        <legend>Your subjects</legend>
        <p>Select each subject you want to see in your library and use for AI Study.</p>
        <div className="learning-subject-options">
          {availableSubjects.map((subject) => (
            <label key={subject.slug} className={`learning-subject-option ${subjects.includes(subject.name) ? 'is-selected' : ''}`}>
              <input
                type="checkbox"
                value={subject.name}
                checked={subjects.includes(subject.name)}
                onChange={() => toggleSubject(subject.name)}
                disabled={busy}
              />
              <span>{subject.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="learning-preferences-error" role="alert">{error}</p>}
      <div className="learning-preferences-actions">
        {onSkip && <button className="learning-preferences-skip" type="button" onClick={() => void skip()} disabled={busy}>Skip for now</button>}
        <button className="learning-preferences-submit" type="submit" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
