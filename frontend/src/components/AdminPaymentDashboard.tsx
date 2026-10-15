import { useCallback, useEffect, useState } from 'react';
import { readAuthSession, type AuthSession } from '../utils/authSession';

interface Payment {
  id: number;
  email: string;
  username: string | null;
  resourceTitle: string;
  amountUgx: number;
  senderPhone: string;
  status: 'pending' | 'verified' | 'sending' | 'approved' | 'downloading' | 'downloaded' | 'rejected';
}

interface AdminSessionUser {
  role?: string;
}

function apiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return fallback;
}

export default function AdminPaymentDashboard({ apiUrl }: { apiUrl: string }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [session, setSession] = useState<AuthSession<AdminSessionUser> | null>(null);
  const apiBase = apiUrl.replace(/\/+$/, '');

  useEffect(() => {
    setSession(readAuthSession<AdminSessionUser>());
  }, []);

  const loadPayments = useCallback(async () => {
    if (!session || !apiBase) return;
    setError('');
    try {
      const response = await fetch(`${apiBase}/api/document-payments/admin/requests`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(payload, 'Payment queue could not be loaded.'));
      if (typeof payload !== 'object' || payload === null || !('payments' in payload) || !Array.isArray(payload.payments)) {
        throw new Error('Payment queue response is invalid.');
      }
      setPayments(payload.payments as Payment[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Payment queue could not be loaded.');
    }
  }, [apiBase, session?.token]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  async function act(paymentId: number, action: 'verify' | 'reject') {
    if (!session || !apiBase) return;
    setBusyId(paymentId);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${apiBase}/api/document-payments/admin/requests/${paymentId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(payload, `Could not ${action} payment.`));
      setMessage(action === 'verify'
        ? 'Payment verified. The user can download their document from their profile.'
        : 'Payment request rejected.');
      await loadPayments();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Could not ${action} payment.`);
    } finally {
      setBusyId(null);
    }
  }

  if (!session) return <p className="admin-payments-notice">Sign in with an administrator account to access payment verification.</p>;
  if (session.user.role !== 'admin') return <p className="admin-payments-notice">Administrator access is required.</p>;

  return (
    <main className="admin-payments">
      <header className="admin-payments-header">
        <div>
          <p className="admin-payments-kicker">Study Hub admin</p>
          <h1>Payment verification</h1>
          <p>Compare the submitted sender number with your received Mobile Money messages. Verify confirmed payments or reject mismatches.</p>
        </div>
        <button type="button" onClick={() => void loadPayments()}>Refresh queue</button>
      </header>
      {message && <p className="admin-payments-message" role="status">{message}</p>}
      {error && <p className="admin-payments-error" role="alert">{error}</p>}
      {!apiBase && <p className="admin-payments-error" role="alert">Payment API is not configured.</p>}
      <div className="admin-payment-table-wrap">
        <table className="admin-payment-table">
          <thead>
            <tr><th>User</th><th>Resource</th><th>Sender number</th><th>Amount</th><th>Status</th><th>Verification</th></tr>
          </thead>
          <tbody>
            {payments.map((payment) => {
              const name = payment.username?.trim() || payment.email;
              const subject = encodeURIComponent('Study Hub payment verification');
              const body = encodeURIComponent(
                'Transaction terminated, invalid credentials.\n\nDear user,\n\nMake sure the number submitted has actually made a cash transfer to our business number.\n\nStudy Hub',
              );
              const address = encodeURIComponent(payment.email).replace(/%40/gi, '@');
              const mailto = `mailto:${address}?subject=${subject}&body=${body}`;
              const canVerify = payment.status === 'pending' || payment.status === 'verified';
              return (
                <tr key={payment.id}>
                  <td>
                    <strong>{name}</strong>
                    <a href={mailto} onClick={() => void act(payment.id, 'reject')}>{payment.email}</a>
                  </td>
                  <td>{payment.resourceTitle}</td>
                  <td>{payment.senderPhone}</td>
                  <td>UGX {payment.amountUgx.toLocaleString()}</td>
                  <td><span className={`admin-payment-status is-${payment.status}`}>{payment.status}</span></td>
                  <td>
                    {canVerify ? (
                      <div className="admin-payment-actions">
                        <button type="button" disabled={busyId === payment.id} onClick={() => void act(payment.id, 'verify')}>
                          {busyId === payment.id ? 'Verifying…' : 'Verify payment'}
                        </button>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
            {payments.length === 0 && <tr><td colSpan={6}>No payment requests yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
