import { useCallback, useEffect, useState } from 'react';
import { readAuthSession, type AuthSession } from '../utils/authSession';

interface Payment {
  id: number;
  email: string;
  username: string;
  resourceTitle: string;
  amountUgx: number;
  senderPhone: string;
  transactionId: string;
  payerSms: string;
  status: 'pending' | 'verified' | 'sending' | 'approved' | 'rejected';
  receivedSenderPhone: string | null;
  receivedRecipientPhone: string | null;
  receivedAmountUgx: number | null;
  receivedTransactionId: string | null;
  receivedSms: string | null;
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

export default function AdminPaymentDashboard({ apiUrl, receiverPhone }: { apiUrl: string; receiverPhone: string }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});
  const [session, setSession] = useState<AuthSession<AdminSessionUser> | null>(null);
  const apiBase = apiUrl.replace(/\/+$/, '');
  const canPreviewDelivery = import.meta.env.DEV;

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

  async function act(paymentId: number, action: 'tally' | 'approve' | 'reject', form?: HTMLFormElement) {
    if (!session || !apiBase) return;
    setBusyId(paymentId);
    setError('');
    setMessage('');
    try {
      let body: Record<string, string | number> | undefined;
      if (action === 'tally' && form) {
        const data = new FormData(form);
        body = {
          senderPhone: String(data.get('senderPhone') || ''),
          recipientPhone: String(data.get('recipientPhone') || ''),
          amountUgx: Number(data.get('amountUgx')),
          transactionId: String(data.get('transactionId') || ''),
          receivedSms: String(data.get('receivedSms') || ''),
        };
      }
      const response = await fetch(`${apiBase}/api/document-payments/admin/requests/${paymentId}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(apiErrorMessage(payload, `Could not ${action} payment.`));
      }
      const emailFailed = action === 'approve'
        && typeof payload === 'object'
        && payload !== null
        && 'emailSent' in payload
        && payload.emailSent === false;
      setMessage(
        action === 'approve'
          ? emailFailed
            ? 'Payment approved. Email failed; the buyer’s open checkout page will download the document automatically.'
            : 'Payment approved and document email sent. The buyer’s open checkout page will also download the document.'
          : action === 'tally'
            ? 'Tally matched. Review the details, then approve and email.'
            : 'Payment request rejected.',
      );
      await loadPayments();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Could not ${action} payment.`);
    } finally {
      setBusyId(null);
    }
  }

  async function previewDelivery(paymentId: number) {
    if (!session || !apiBase) return;
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${apiBase}/api/document-payments/admin/requests/${paymentId}/delivery-preview`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(payload, 'The document preview could not be opened.'));
      if (typeof payload !== 'object' || payload === null || !('deliveryUrl' in payload) || typeof payload.deliveryUrl !== 'string') {
        throw new Error('Document preview response is invalid.');
      }
      const deliveryUrl = payload.deliveryUrl;
      setPreviewUrls((current) => ({ ...current, [paymentId]: deliveryUrl }));
      setMessage('Development preview ready. This does not approve the payment or send an email.');
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'The document preview could not be opened.');
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
          <p>Compare the payer submission with your received Mobile Money SMS. Tally first, then approve to email the document.</p>
        </div>
        <button type="button" onClick={() => void loadPayments()}>Refresh queue</button>
      </header>
      {message && <p className="admin-payments-message" role="status">{message}</p>}
      {error && <p className="admin-payments-error" role="alert">{error}</p>}
      {!apiBase && <p className="admin-payments-error" role="alert">Payment API is not configured.</p>}
      <div className="admin-payment-list">
        {payments.map((payment) => (
          <article className="admin-payment-card" key={payment.id}>
            <div className="admin-payment-summary">
              <div>
                <span className={`admin-payment-status is-${payment.status}`}>{payment.status}</span>
                <h2>{payment.resourceTitle}</h2>
                <p>{payment.username} · {payment.email}</p>
              </div>
              <strong>UGX {payment.amountUgx.toLocaleString()}</strong>
            </div>
            <dl className="admin-payment-submission">
              <div><dt>Payer number</dt><dd>{payment.senderPhone}</dd></div>
              <div><dt>Transaction ID</dt><dd>{payment.transactionId}</dd></div>
            </dl>
            {canPreviewDelivery && (
              <div className="admin-payment-preview">
                <button type="button" onClick={() => void previewDelivery(payment.id)}>
                  Prepare development preview (no approval or email)
                </button>
                {previewUrls[payment.id] && (
                  <a href={previewUrls[payment.id]} target="_blank" rel="noopener noreferrer">
                    Open document preview
                  </a>
                )}
              </div>
            )}
            <details>
              <summary>View payer confirmation SMS</summary>
              <pre>{payment.payerSms}</pre>
            </details>
            {payment.status === 'pending' && (
              <form
                className="admin-payment-tally"
                onSubmit={(event) => {
                  event.preventDefault();
                  void act(payment.id, 'tally', event.currentTarget);
                }}
              >
                <h3>Tally received payment</h3>
                <label>Received sender number<input name="senderPhone" type="tel" required defaultValue={payment.senderPhone} /></label>
                <label>Received-to number<input name="recipientPhone" type="tel" required defaultValue={receiverPhone} /></label>
                <label>Received amount (UGX)<input name="amountUgx" type="number" min="1" required defaultValue={payment.amountUgx} /></label>
                <label>Received transaction ID<input name="transactionId" type="text" required defaultValue={payment.transactionId} /></label>
                <label className="admin-payment-sms">Paste your received payment SMS<textarea name="receivedSms" minLength={10} maxLength={5000} required rows={4} /></label>
                <button type="submit" disabled={busyId === payment.id}>{busyId === payment.id ? 'Checking…' : 'Tally payment details'}</button>
              </form>
            )}
            {payment.status === 'verified' && (
              <>
                <p className="admin-payment-match">Tally matched: {payment.receivedSenderPhone}, {payment.receivedRecipientPhone}, UGX {payment.receivedAmountUgx?.toLocaleString()}, transaction {payment.receivedTransactionId}.</p>
                <details><summary>View received confirmation SMS</summary><pre>{payment.receivedSms}</pre></details>
                <div className="admin-payment-final-actions">
                  <button type="button" disabled={busyId === payment.id} onClick={() => void act(payment.id, 'approve')}>Final approve &amp; email document</button>
                  <button type="button" className="is-reject" disabled={busyId === payment.id} onClick={() => void act(payment.id, 'reject')}>Reject request</button>
                </div>
              </>
            )}
          </article>
        ))}
        {payments.length === 0 && !error && <p className="admin-payments-notice">No payment requests are waiting.</p>}
      </div>
    </main>
  );
}
