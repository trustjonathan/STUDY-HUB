import { useEffect, useState } from 'react';
import AdminPaymentDashboard from './AdminPaymentDashboard';
import ResourceUploadPanel from './ResourceUploadPanel';

type AdminSection = 'payments' | 'resources';

export default function AdminWorkspace({ apiUrl }: { apiUrl: string }) {
  const [section, setSection] = useState<AdminSection>('payments');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(window.matchMedia('(min-width: 761px)').matches);
  }, []);

  function selectSection(nextSection: AdminSection) {
    setSection(nextSection);
    setSidebarOpen(window.matchMedia('(min-width: 761px)').matches);
  }

  return (
    <div className="admin-workspace">
      {sidebarOpen && (
        <button
          className="admin-workspace-backdrop"
          type="button"
          aria-label="Close admin navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside id="admin-workspace-navigation" className={`admin-workspace-sidebar ${sidebarOpen ? 'is-open' : 'is-collapsed'}`} aria-label="Admin dashboard navigation">
        <div className="admin-workspace-brand">
          <strong>Study Hub Admin</strong>
          <button type="button" className="admin-workspace-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}>×</button>
        </div>
        <nav>
          <button
            type="button"
            className={section === 'payments' ? 'is-active' : ''}
            aria-current={section === 'payments' ? 'page' : undefined}
            onClick={() => selectSection('payments')}
          >
            <span aria-hidden="true">✓</span> Payment verification
          </button>
          <button
            type="button"
            className={section === 'resources' ? 'is-active' : ''}
            aria-current={section === 'resources' ? 'page' : undefined}
            onClick={() => selectSection('resources')}
          >
            <span aria-hidden="true">↥</span> Resource uploads
          </button>
        </nav>
      </aside>
      <div className="admin-workspace-content">
        <button
          className="admin-workspace-menu"
          type="button"
          aria-expanded={sidebarOpen}
          aria-controls="admin-workspace-navigation"
          onClick={() => setSidebarOpen((open) => !open)}
        >
          <span aria-hidden="true">☰</span> Admin menu
        </button>
        <div className="admin-workspace-panel">
          {section === 'payments'
            ? <AdminPaymentDashboard apiUrl={apiUrl} />
            : <ResourceUploadPanel apiUrl={apiUrl} />}
        </div>
      </div>
    </div>
  );
}
