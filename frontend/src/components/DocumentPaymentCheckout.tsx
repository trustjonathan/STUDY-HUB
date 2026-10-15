import { useEffect, useState, type SyntheticEvent } from 'react';
import { readAuthSession, type AuthSession } from '../utils/authSession';

interface Props {
  apiUrl: string;
  base: string;
  receiverPhone: string;
}

const PRICE_UGX = 1000;

function apiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return fallback;
}

export default function DocumentPaymentCheckout({ apiUrl, base, receiverPhone }: Props) {
  const [resourceId, setResourceId] = useState('');
  const [resourceTitle, setResourceTitle] = useState('Study Hub document');
  const [session, setSession] = useState<AuthSession<{ email?: string }> | null>(null);
  const [started, setStarted] = useState(false);
  const [senderPhone, setSenderPhone] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [payerSms, setPayerSms] = useState('');
  const [working, setWorking] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const apiBase = apiUrl.replace(/\/+$/, '');

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const currentResourceId = search.get('resource_id') || '';
    setResourceId(currentResourceId);
    setResourceTitle(search.get('title') || 'Study Hub document');
    setSession(readAuthSession<{ email?: string }>());
    const savedPayment = sessionStorage.getItem('study-hub-pending-document-payment');
    if (savedPayment) {
      try {
        const parsed: unknown = JSON.parse(savedPayment);
        if (
          typeof parsed === 'object'
          && parsed !== null
          && 'id' in parsed
          && (typeof parsed.id === 'string' || typeof parsed.id === 'number')
          && 'resourceId' in parsed
          && parsed.resourceId === currentResourceId
        ) {
          setPaymentId(String(parsed.id));
          setSubmitted(true);
        }
      } catch {
        sessionStorage.removeItem('study-hub-pending-document-payment');
      }
    }
  }, []);

  useEffect(() => {
    if (!session || !apiBase || !paymentId || downloadComplete) return;
    const activeSession = session;
    const activeApiBase = apiBase;
    const activePaymentId = paymentId;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    async function checkForApprovedDownload() {
      try {
        const response = await fetch(`${activeApiBase}/api/document-payments/requests/${encodeURIComponent(activePaymentId)}/download`, {
          headers: { Authorization: `Bearer ${activeSession.token}` },
        });
        if (response.status === 202) {
          await response.json();
          if (!cancelled) {
            setMessage('Your request is being verified. Keep this page open; your document will download automatically after approval.');
            retryTimer = setTimeout(() => void checkForApprovedDownload(), 5000);
          }
          return;
        }
        if (!response.ok) {
          const payload: unknown = await response.json();
          if (!cancelled) {
            setError(apiErrorMessage(payload, 'The approved document could not be downloaded.'));
            if (response.status !== 401 && response.status !== 403 && response.status !== 404) {
              retryTimer = setTimeout(() => void checkForApprovedDownload(), 10000);
            }
          }
          return;
        }

        const documentBlob = await response.blob();
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(documentBlob);
        const downloadLink = document.createElement('a');
        const contentDisposition = response.headers.get('content-disposition') || '';
        const encodedFilename = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
        let filename = `${resourceTitle.replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').trim() || 'Study Hub document'}.pdf`;
        if (encodedFilename) {
          try {
            filename = decodeURIComponent(encodedFilename);
          } catch {
            filename = 'Study Hub document.pdf';
          }
        }
        downloadLink.href = objectUrl;
        downloadLink.download = filename;
        downloadLink.hidden = true;
        document.body.append(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
        const savedPayment = sessionStorage.getItem('study-hub-pending-document-payment');
        if (savedPayment) {
          try {
            const parsed: unknown = JSON.parse(savedPayment);
            if (typeof parsed === 'object' && parsed !== null && 'id' in parsed && parsed.id === activePaymentId) {
              sessionStorage.removeItem('study-hub-pending-document-payment');
            }
          } catch {
            sessionStorage.removeItem('study-hub-pending-document-payment');
          }
        }
        setDownloadComplete(true);
        setError('');
        setMessage('Payment approved. Your document download has started.');
      } catch (downloadError) {
        if (!cancelled) {
          setError(downloadError instanceof Error ? downloadError.message : 'The approved document could not be downloaded.');
          retryTimer = setTimeout(() => void checkForApprovedDownload(), 10000);
        }
      }
    }

    void checkForApprovedDownload();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [apiBase, downloadComplete, paymentId, resourceTitle, session]);

  const checkoutReturn = `${base}document-payment.html?${new URLSearchParams({ resource_id: resourceId, title: resourceTitle })}`;
  const signInHref = `${base}sign-in.html?return=${encodeURIComponent(checkoutReturn)}`;

  function initiatePayment() {
    setError('');
    setMessage('');
    if (!session) {
      setError('Sign in first so we can link the payment request to your account.');
      return;
    }
    if (!resourceId.startsWith('sh:') && !resourceId.startsWith('ft:')) {
      setError('This document is not available for paid delivery.');
      return;
    }

    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(receiverPhone).then(
        () => setMessage(`Payment number ${receiverPhone} copied.`),
        () => setMessage(`Copy the payment number manually: ${receiverPhone}`),
      );
    } else {
      setMessage(`Copy the payment number manually: ${receiverPhone}`);
    }
    setStarted(true);
    if (window.matchMedia('(pointer: coarse)').matches) {
      window.location.href = 'tel:%2A185%23';
    } else {
      setMessage(`Payment number ${receiverPhone} copied. On your phone, dial *185# to send UGX ${PRICE_UGX.toLocaleString()}.`);
    }
  }

  async function submitPayment(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !apiBase) {
      setError(!session ? 'Sign in before submitting payment details.' : 'The payment service is not configured.');
      return;
    }

    setWorking(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${apiBase}/api/document-payments/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ resourceId, resourceTitle, senderPhone, transactionId, payerSms }),
      });
      const payload: unknown = await response.json();
      if (response.status === 401 || response.status === 403) {
        setError('Your sign-in session has expired. Sign in again and resubmit your payment details.');
        return;
      }
      if (!response.ok) throw new Error(apiErrorMessage(payload, 'Your payment request could not be submitted.'));
      if (
        typeof payload !== 'object'
        || payload === null
        || !('payment' in payload)
        || typeof payload.payment !== 'object'
        || payload.payment === null
        || !('id' in payload.payment)
        || (typeof payload.payment.id !== 'number' && typeof payload.payment.id !== 'string')
      ) {
        throw new Error('The payment service returned an invalid request confirmation.');
      }
      const submittedId = String(payload.payment.id);
      let persistenceMessage = '';
      try {
        sessionStorage.setItem('study-hub-pending-document-payment', JSON.stringify({ id: submittedId, resourceId }));
      } catch {
        persistenceMessage = ' Keep this page open; this browser could not save the download reminder.';
      }
      setPaymentId(submittedId);
      setSubmitted(true);
      setMessage(`Request received. Keep this page open; after admin verification your document will download here and be emailed to your account.${persistenceMessage}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Your payment request could not be submitted.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="payment-checkout-page">
      <section className="payment-checkout-card" aria-labelledby="payment-heading">
        <a className="payment-checkout-back" href={`${base}library.html`}>← Back to Library</a>
        <p className="payment-checkout-kicker">Study Hub document delivery</p>
        <h1 id="payment-heading">Complete your payment</h1>
        <p className="payment-checkout-title">{resourceTitle}</p>
        <div className="payment-checkout-amount">
          <span>Amount</span>
          <strong>UGX {PRICE_UGX.toLocaleString()}</strong>
          <small>per document</small>
        </div>
        <div className="payment-checkout-instructions">
          <p><strong>1.</strong> Send UGX {PRICE_UGX.toLocaleString()} to Airtel/MTN number <strong>{receiverPhone}</strong>.</p>
          <p><strong>2.</strong> Tap the button below. We’ll copy the number and, on a phone, open the *185# dialer for you to confirm.</p>
          <p><strong>3.</strong> Complete the payment on your phone, then paste the confirmation SMS and transaction details below.</p>
          <p><strong>4.</strong> After admin tally and approval, your document downloads on this device and is emailed to your signed-in address.</p>
        </div>

        {!session ? (
          <div className="payment-checkout-signin">
            <p>Sign in to submit this payment request and receive the document by email.</p>
            <a className="payment-primary-button" href={signInHref}>Sign in to continue</a>
          </div>
        ) : (
          <>
            <p className="payment-account-email">Signed in as <strong>{session.user.email || 'your Study Hub account'}</strong></p>
            <button className="payment-primary-button" type="button" onClick={initiatePayment}>
              {started ? 'Open payment instructions again' : 'Initiate transaction'}
            </button>
          </>
        )}
        {message && <p className="payment-message" role="status">{message}</p>}
        {error && <p className="payment-error" role="alert">{error}</p>}

        {session && started && !submitted && (
          <form className="payment-submission-form" onSubmit={(event) => void submitPayment(event)}>
            <h2>Submit payment for verification</h2>
            <label>
              Sender mobile number
              <input
                type="tel"
                autoComplete="tel"
                required
                maxLength={20}
                placeholder="07XXXXXXXX"
                value={senderPhone}
                onChange={(event) => setSenderPhone(event.target.value)}
              />
            </label>
            <label>
              Mobile Money transaction ID
              <input
                type="text"
                required
                maxLength={100}
                autoCapitalize="characters"
                placeholder="Transaction ID from the SMS"
                value={transactionId}
                onChange={(event) => setTransactionId(event.target.value)}
              />
            </label>
            <label>
              Paste the payment confirmation SMS
              <textarea
                required
                minLength={10}
                maxLength={5000}
                rows={4}
                placeholder="Paste the SMS you received after payment"
                value={payerSms}
                onChange={(event) => setPayerSms(event.target.value)}
              />
            </label>
            <button className="payment-primary-button" type="submit" disabled={working}>
              {working ? 'Submitting…' : 'Send payment for verification'}
            </button>
          </form>
        )}
        {submitted && !downloadComplete && <p className="payment-pending-note">Your request is awaiting tally and final admin verification. Keep this page open so the approved document can download automatically.</p>}
        {!apiBase && <p className="payment-error" role="alert">Payment service is not configured. Please contact Study Hub support.</p>}
      </section>
    </main>
  );
}
