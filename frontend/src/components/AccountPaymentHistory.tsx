import { useCallback, useEffect, useRef, useState } from 'react';
import { readAuthSession, type AuthSession } from '../utils/authSession';

interface Payment {
  id: number;
  resourceTitle: string;
  amountUgx: number;
  senderPhone: string;
  status: 'pending' | 'verified' | 'sending' | 'approved' | 'downloading' | 'downloaded' | 'rejected';
  createdAt: string;
  downloadedAt: string | null;
}

interface AccountUser {
  email?: string;
}

function apiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return fallback;
}

export default function AccountPaymentHistory({ apiUrl, base }: { apiUrl: string; base: string }) {
  const [session, setSession] = useState<AuthSession<AccountUser> | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const activeDownloads = useRef(new Set<number>());
  const apiBase = apiUrl.replace(/\/+$/, '');

  useEffect(() => {
    const activeSession = readAuthSession<AccountUser>();
    setSession(activeSession);
    if (!activeSession) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`${base}sign-in.html?return=${encodeURIComponent(returnTo)}`);
    }
  }, [base]);

  const loadPayments = useCallback(async () => {
    if (!session || !apiBase) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${apiBase}/api/document-payments/mine`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(payload, 'Your payment history could not be loaded.'));
      if (typeof payload !== 'object' || payload === null || !('payments' in payload) || !Array.isArray(payload.payments)) {
        throw new Error('Payment history response is invalid.');
      }
      setPayments(payload.payments as Payment[]);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Your payment history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [apiBase, session?.token]);

  useEffect(() => {
    void loadPayments();
    const timer = window.setInterval(() => void loadPayments(), 10000);
    return () => window.clearInterval(timer);
  }, [loadPayments]);

  const downloadPayment = useCallback(async (payment: Payment) => {
    if (!session || !apiBase || activeDownloads.current.has(payment.id)) return;
    activeDownloads.current.add(payment.id);
    setDownloadingId(payment.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${apiBase}/api/document-payments/requests/${payment.id}/download`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (response.status === 202) {
        setMessage('Your request is still being verified. This page will keep checking for approval.');
        return;
      }
      if (!response.ok) {
        const payload: unknown = await response.json();
        throw new Error(apiErrorMessage(payload, 'The document could not be downloaded. Try again from your profile.'));
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const contentDisposition = response.headers.get('content-disposition') || '';
      const encodedFilename = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      let filename = `${payment.resourceTitle.replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').trim() || 'Study Hub document'}.pdf`;
      if (encodedFilename) {
        try {
          filename = decodeURIComponent(encodedFilename);
        } catch {
          filename = 'Study Hub document.pdf';
        }
      }
      link.href = objectUrl;
      link.download = filename;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      setMessage('Your document download has started.');
      await loadPayments();
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'The document could not be downloaded.');
    } finally {
      activeDownloads.current.delete(payment.id);
      setDownloadingId(null);
    }
  }, [apiBase, loadPayments, session]);

  useEffect(() => {
    const approved = payments.find((payment) => payment.status === 'approved' && !activeDownloads.current.has(payment.id));
    if (approved) void downloadPayment(approved);
  }, [downloadPayment, payments]);

  if (!session) {
    return (
      <main className="account-payments">
        <h1>Your Study Hub account</h1>
        <p>Sign in to view your payment requests and resume approved downloads.</p>
        <a className="payment-primary-button" href={`${base}sign-in.html?return=${encodeURIComponent(`${base}account.html`)}`}>Sign in</a>
      </main>
    );
  }

  return (
    <main className="account-payments">
      <header className="account-payments-header">
        <p className="payment-checkout-kicker">Study Hub account</p>
        <h1>Your downloads</h1>
        <p>Requests are saved to your account. Approved documents can be downloaded once; unfinished downloads remain available to resume.</p>
      </header>
      {message && <p className="payment-message" role="status">{message}</p>}
      {error && <p className="payment-error" role="alert">{error}</p>}
      {!apiBase && <p className="payment-error" role="alert">Payment service is not configured. Please contact Study Hub support.</p>}
      {loading && <p>Loading your payment history…</p>}
      {!loading && payments.length === 0 && <p>You have no document payment requests yet.</p>}
      <div className="account-payment-list">
        {payments.map((payment) => (
          <article className="account-payment-card" key={payment.id}>
            <div>
              <span className={`admin-payment-status is-${payment.status}`}>{payment.status}</span>
              <h2>{payment.resourceTitle}</h2>
              <p>Sender number: {payment.senderPhone}</p>
              <p>Requested {new Date(payment.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="account-payment-actions">
              {payment.status === 'approved' && (
                <button className="payment-primary-button" type="button" disabled={downloadingId === payment.id} onClick={() => void downloadPayment(payment)}>
                  {downloadingId === payment.id ? 'Preparing download…' : 'Resume download'}
                </button>
              )}
              {payment.status === 'downloaded' && <p>Downloaded{payment.downloadedAt ? ` on ${new Date(payment.downloadedAt).toLocaleDateString()}` : ''}. This one-time request is complete.</p>}
              {payment.status === 'pending' && <p>Waiting for payment verification.</p>}
              {payment.status === 'verified' || payment.status === 'sending' || payment.status === 'downloading'
                ? <p>Verification or download is in progress.</p>
                : null}
              {payment.status === 'rejected' && <p>This request was rejected. Please contact Study Hub if you need help.</p>}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
