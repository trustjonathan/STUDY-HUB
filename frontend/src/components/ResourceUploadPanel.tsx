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

interface ManagedResource {
  title: string;
  filename: string;
  path: string;
  category: string;
  year: string;
  subject: string;
  type: string;
  archivedAt?: string;
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
  const [resources, setResources] = useState<ManagedResource[]>([]);
  const [archivedResources, setArchivedResources] = useState<ManagedResource[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [resourceCategoryFilter, setResourceCategoryFilter] = useState('all');
  const [resourceSearch, setResourceSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'manage'>('upload');
  const [movingPath, setMovingPath] = useState('');
  const [moveCategory, setMoveCategory] = useState('');
  const [moveYear, setMoveYear] = useState('');
  const [moveFilename, setMoveFilename] = useState('');
  const [moveTitle, setMoveTitle] = useState('');
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
  const [loadingResources, setLoadingResources] = useState(false);
  const [busyPath, setBusyPath] = useState('');
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

  const loadResources = useCallback(async () => {
    if (!session?.token || !apiBase) return;
    setLoadingResources(true);
    setError('');
    try {
      const response = await fetch(`${apiBase}/api/resources/admin/archive/resources`, {
        headers: { Authorization: ['Bearer', session.token].join(' ') },
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(getError(payload, 'Archive resources could not be loaded.'));
      if (
        typeof payload !== 'object'
        || payload === null
        || !('resources' in payload)
        || !Array.isArray(payload.resources)
        || !('archivedResources' in payload)
        || !Array.isArray(payload.archivedResources)
      ) {
        throw new Error('Archive resources response is invalid.');
      }
      setResources(payload.resources as ManagedResource[]);
      setArchivedResources(payload.archivedResources as ManagedResource[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Archive resources could not be loaded.');
    } finally {
      setLoadingResources(false);
    }
  }, [apiBase, session?.token]);

  useEffect(() => {
    void loadCategories();
    void loadResources();
  }, [loadCategories, loadResources]);

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
      await Promise.all([loadCategories(), loadResources()]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'The file could not be uploaded.');
    } finally {
      setUploading(false);
    }
  }

  async function updateResource(action: 'archive' | 'restore' | 'move', resource: ManagedResource) {
    if (!session?.token || !apiBase) {
      setError('Sign in with an administrator account and confirm the API is configured.');
      return;
    }
    if (action === 'move' && (!moveCategory || !moveYear)) {
      setError('Choose a destination category and year.');
      return;
    }
    if (
      action === 'move'
      && !window.confirm('Moving changes this resource’s public URL. Previously shared links or existing paid-download links to the old URL may stop working. Continue?')
    ) return;

    const endpoint = action === 'move' ? 'move' : action;
    const body = action === 'move'
      ? { path: resource.path, category: moveCategory, year: moveYear, filename: moveFilename, title: moveTitle }
      : { path: resource.path };
    setBusyPath(resource.path);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${apiBase}/api/resources/admin/archive/resources/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: ['Bearer', session.token].join(' '),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(getError(payload, `The resource could not be ${action}d.`));
      const result = payload as UploadResult;
      setMessage(typeof result.error === 'string' ? result.error : (
        action === 'archive' ? 'Resource hidden from the library. The file is retained and can be restored.'
          : action === 'restore' ? 'Resource restored to the public library.'
            : 'Resource moved or renamed successfully.'
      ));
      setMovingPath('');
      await Promise.all([loadCategories(), loadResources()]);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `The resource could not be ${action}d.`);
    } finally {
      setBusyPath('');
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
          <h1>{activeTab === 'upload' ? 'Archive resource management' : 'Manage archive resources'}</h1>
          <p>Upload files, browse all category folders, hide resources without deleting them, restore archived files, or move a file to another category.</p>
        </div>
        <button type="button" onClick={() => void Promise.all([loadCategories(), loadResources()])} disabled={loadingCategories || loadingResources || uploading || Boolean(busyPath)}>
          {loadingCategories || loadingResources ? 'Refreshing…' : 'Refresh archive'}
        </button>
      </header>
      {message && <p className="admin-payments-message" role="status">{message}</p>}
      {error && <p className="admin-payments-error" role="alert">{error}</p>}
      {!apiBase && <p className="admin-payments-error" role="alert">The Study Hub API is not configured.</p>}
      <div className="admin-resource-tabs" role="group" aria-label="Resource archive actions">
        <button type="button" aria-pressed={activeTab === 'upload'} className={activeTab === 'upload' ? 'is-active' : ''} onClick={() => setActiveTab('upload')}>Upload resource</button>
        <button type="button" aria-pressed={activeTab === 'manage'} className={activeTab === 'manage' ? 'is-active' : ''} onClick={() => { setActiveTab('manage'); void loadResources(); }}>Browse and manage files <span>{resources.length + archivedResources.length}</span></button>
      </div>
      {activeTab === 'upload' ? (
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
      ) : (
        <section className="admin-resource-manager" aria-label="Archive resource list">
          <div className="admin-resource-manager-filters">
            <label>
              Search by file name or title
              <input value={resourceSearch} onChange={(event) => setResourceSearch(event.target.value)} placeholder="Search resources…" />
            </label>
            <label>
              Category
              <select value={resourceCategoryFilter} onChange={(event) => setResourceCategoryFilter(event.target.value)}>
                <option value="all">All categories</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
          </div>
          {loadingResources
            ? <p className="admin-resource-list-state" role="status">Loading archive catalog…</p>
            : (
              <>
                {[
                  { title: 'In the public library', items: resources, archived: false },
                  { title: 'Archived (hidden)', items: archivedResources, archived: true },
                ].map((group) => {
                  const query = resourceSearch.trim().toLocaleLowerCase();
                  const filtered = group.items.filter((resource) =>
                    (resourceCategoryFilter === 'all' || resource.category === resourceCategoryFilter)
                    && (!query || `${resource.title} ${resource.filename} ${resource.subject} ${resource.category}`.toLocaleLowerCase().includes(query)));
                  return (
                    <section key={group.title} className="admin-resource-list-group">
                      <h2>{group.title} <span>{filtered.length.toLocaleString()}</span></h2>
                      {filtered.length === 0
                        ? <p className="admin-resource-list-state">No files match this filter.</p>
                        : filtered.map((resource) => (
                          <article key={resource.path} className="admin-resource-list-item">
                            <div className="admin-resource-list-details">
                              <strong>{resource.title}</strong>
                              <span>{resource.category} / {resource.year} / {resource.filename}</span>
                              <small>{resource.subject} · {resource.type}{resource.archivedAt ? ` · Archived ${new Date(resource.archivedAt).toLocaleDateString()}` : ''}</small>
                            </div>
                            <div className="admin-resource-list-actions">
                              {group.archived ? (
                                <button type="button" disabled={busyPath === resource.path} onClick={() => void updateResource('restore', resource)}>
                                  {busyPath === resource.path ? 'Restoring…' : 'Restore'}
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="is-secondary"
                                    onClick={() => {
                                      setMovingPath(movingPath === resource.path ? '' : resource.path);
                                      setMoveCategory(resource.category);
                                      setMoveYear(resource.year);
                                      setMoveFilename(resource.filename || resource.path.split('/').pop() || '');
                                      setMoveTitle(resource.title);
                                      setError('');
                                    }}
                                  >
                                    Move / Rename
                                  </button>
                                  <button type="button" className="is-archive" disabled={busyPath === resource.path} onClick={() => void updateResource('archive', resource)}>
                                    {busyPath === resource.path ? 'Archiving…' : 'Hide'}
                                  </button>
                                </>
                              )}
                            </div>
                            {movingPath === resource.path && !group.archived && (
                              <div className="admin-resource-move-form">
                                <label>
                                  Destination category
                                  <select value={moveCategory} onChange={(event) => setMoveCategory(event.target.value)}>
                                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                                  </select>
                                </label>
                                <label>
                                  Year folder
                                  <input value={moveYear} onChange={(event) => setMoveYear(event.target.value)} maxLength={7} />
                                </label>
                                <label>
                                  File name
                                  <input value={moveFilename} onChange={(event) => setMoveFilename(event.target.value)} maxLength={180} required />
                                </label>
                                <label>
                                  Library title
                                  <input value={moveTitle} onChange={(event) => setMoveTitle(event.target.value)} maxLength={200} required />
                                </label>
                                <button type="button" disabled={busyPath === resource.path} onClick={() => void updateResource('move', resource)}>
                                  {busyPath === resource.path ? 'Saving…' : 'Confirm changes'}
                                </button>
                                <button type="button" className="is-secondary" onClick={() => setMovingPath('')}>Cancel</button>
                              </div>
                            )}
                          </article>
                        ))}
                    </section>
                  );
                })}
                <p className="admin-resource-retention-note">Hide keeps files in the repository and removes them from the public library. This board does not permanently delete archive files. Moves update the file path and catalog together; the public URL changes, so old shared or paid-download links may stop working.</p>
              </>
            )}
        </section>
      )}
    </main>
  );
}
