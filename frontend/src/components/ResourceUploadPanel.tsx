import { useCallback, useEffect, useState, type SyntheticEvent } from 'react';
import { readAuthSession, type AuthSession } from '../utils/authSession';

interface AdminUser {
  role?: string;
}

interface UploadResult {
  success?: boolean;
  error?: string;
  resource?: { title?: string };
}

const CLASS_OPTIONS = [
  { key: 'p1', label: 'P.1' }, { key: 'p2', label: 'P.2' }, { key: 'p3', label: 'P.3' },
  { key: 'p4', label: 'P.4' }, { key: 'p5', label: 'P.5' }, { key: 'p6', label: 'P.6' },
  { key: 'p7', label: 'P.7' }, { key: 's1', label: 'S.1' }, { key: 's2', label: 'S.2' },
  { key: 's3', label: 'S.3' }, { key: 's4', label: 'S.4' }, { key: 's5', label: 'S.5' },
  { key: 's6', label: 'S.6' },
];
const RESOURCE_TYPES = [
  'Past Papers', 'Marking Guides', 'Schemes of Work',
  'Holiday Package', 'Lesson Notes', 'Study Resources',
];
const ACCEPTED_FILES = '.pdf,.doc,.docx,.rtf,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif';

function getError(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return fallback;
}

export default function ResourceUploadPanel({ apiUrl }: { apiUrl: string }) {
  const [session, setSession] = useState<AuthSession<AdminUser> | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('2026');
  const [subject, setSubject] = useState('');
  const [type, setType] = useState('Past Papers');
  const [classKeys, setClassKeys] = useState<string[]>(['unsorted']);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const apiBase = apiUrl.replace(/\/+$/, '');

  useEffect(() => {
    setSession(readAuthSession<AdminUser>());
  }, []);

  const loadCategories = useCallback(async () => {
    if (!session?.token || !apiBase) return;
    setLoadingCategories(true);
    setError('');
    try {
      const response = await fetch(`${apiBase}/api/resources/admin/archive/categories`, {
        headers: { Authorization: ['Bearer', session.token].join(' ') },
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(getError(payload, 'Resource folders could not be loaded.'));
      if (
        typeof payload !== 'object'
        || payload === null
        || !('categories' in payload)
        || !Array.isArray(payload.categories)
        || !payload.categories.every((category): category is string => typeof category === 'string')
      ) {
        throw new Error('Resource folders response is invalid.');
      }
      const loadedCategories = payload.categories;
      setCategories(loadedCategories);
      setSelectedCategory((current) => loadedCategories.includes(current) ? current : loadedCategories[0] || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Resource folders could not be loaded.');
    } finally {
      setLoadingCategories(false);
    }
  }, [apiBase, session?.token]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  function toggleClass(key: string) {
    setClassKeys((current) => {
      if (key === 'unsorted') return current.includes('unsorted') ? [] : ['unsorted'];
      const selected = current.filter((item) => item !== 'unsorted');
      return selected.includes(key)
        ? selected.filter((item) => item !== key)
        : [...selected, key];
    });
  }

  async function submitUpload(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!session?.token || !apiBase) {
      setError('Sign in with an administrator account and confirm the API is configured.');
      return;
    }
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    const category = creatingCategory ? newCategory.trim() : selectedCategory;
    if (!category) {
      setError('Choose or enter a category folder.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    formData.append('year', year.trim() || 'Undated');
    formData.append('title', title.trim());
    formData.append('subject', subject.trim() || 'General');
    formData.append('type', type);
    formData.append('classKeys', JSON.stringify(classKeys));

    setUploading(true);
    try {
      const response = await fetch(`${apiBase}/api/resources/admin/archive/upload`, {
        method: 'POST',
        headers: { Authorization: ['Bearer', session.token].join(' ') },
        body: formData,
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(getError(payload, 'The file could not be uploaded.'));
      const result = payload as UploadResult;
      setMessage(`“${result.resource?.title || title}” was uploaded and registered in the library.`);
      setFile(null);
      setFileInputKey((key) => key + 1);
      setTitle('');
      const createdCategory = creatingCategory ? category : '';
      setCreatingCategory(false);
      setNewCategory('');
      if (createdCategory) setSelectedCategory(createdCategory);
      await loadCategories();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'The file could not be uploaded.');
    } finally {
      setUploading(false);
    }
  }

  if (!session) {
    return <p className="admin-resource-notice">Sign in with an administrator account to upload library resources.</p>;
  }
  if (session.user.role !== 'admin') {
    return <p className="admin-resource-notice">Administrator access is required.</p>;
  }

  return (
    <main className="admin-resource-upload">
      <header className="admin-resource-header">
        <div>
          <p className="admin-payments-kicker">Study Hub admin</p>
          <h1>Upload a library resource</h1>
          <p>Choose an existing archive folder or create a category. The first upload creates new folders, updates the public archive catalog, and leaves Supabase resources untouched.</p>
        </div>
        <button type="button" onClick={() => void loadCategories()} disabled={loadingCategories || uploading}>
          {loadingCategories ? 'Loading folders…' : 'Refresh folders'}
        </button>
      </header>
      {message && <p className="admin-payments-message" role="status">{message}</p>}
      {error && <p className="admin-payments-error" role="alert">{error}</p>}
      {!apiBase && <p className="admin-payments-error" role="alert">The Study Hub API is not configured.</p>}
      <form className="admin-resource-form" onSubmit={submitUpload}>
        <label>
          Category / repository folder
          {!creatingCategory ? (
            <span className="admin-resource-category-row">
              <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} required disabled={loadingCategories}>
                <option value="">Choose a category</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <button type="button" className="admin-resource-secondary" onClick={() => setCreatingCategory(true)}>Create category</button>
            </span>
          ) : (
            <span className="admin-resource-category-row">
              <input
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                maxLength={100}
                placeholder="e.g. Masaka Joint Mock Board"
                required
              />
              <button type="button" className="admin-resource-secondary" onClick={() => setCreatingCategory(false)}>Use existing</button>
            </span>
          )}
        </label>
        <label>
          Resource file
          <input
            key={fileInputKey}
            type="file"
            accept={ACCEPTED_FILES}
            required
            onChange={(event) => {
              const selectedFile = event.target.files?.[0] || null;
              setFile(selectedFile);
              if (selectedFile) {
                setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
                setError('');
              }
            }}
          />
          <small>Supported reader formats; maximum file size is 25 MB. Existing filenames are never overwritten.</small>
        </label>
        <label>
          Display title
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required placeholder="A clear title for students" />
        </label>
        <div className="admin-resource-fields">
          <label>
            Year
            <input value={year} onChange={(event) => setYear(event.target.value)} maxLength={7} placeholder="2026 or Undated" required />
          </label>
          <label>
            Subject
            <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={80} placeholder="e.g. Mathematics" />
          </label>
          <label>
            Resource type
            <select value={type} onChange={(event) => setType(event.target.value)}>
              {RESOURCE_TYPES.map((resourceType) => <option key={resourceType}>{resourceType}</option>)}
            </select>
          </label>
        </div>
        <fieldset className="admin-resource-classes">
          <legend>Class shelves</legend>
          <p>Choose every class that should see this resource. Leave all unchecked to place it under Unsorted files.</p>
          <div>
            {CLASS_OPTIONS.map((option) => (
              <label key={option.key}>
                <input
                  type="checkbox"
                  checked={classKeys.includes(option.key)}
                  onChange={() => toggleClass(option.key)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="admin-resource-submit" type="submit" disabled={uploading || loadingCategories}>
          {uploading ? 'Uploading and updating the library…' : 'Upload resource'}
        </button>
      </form>
    </main>
  );
}
