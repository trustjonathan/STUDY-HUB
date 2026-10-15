const { QueryTypes } = require('sequelize');
const { Readable } = require('node:stream');
const sequelize = require('../../database/config/database');
const resourceService = require('../../services/resourceService');
const emailService = require('../../services/paymentEmailService');

const PRICE_UGX = 1000;
const RECEIVER_PHONE = process.env.PAYMENT_RECEIVER_PHONE || '0701810497';
const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;
const STUDY_HUB_RESOURCE_ID_PATTERN = /^sh:(.{1,2045})$/s;
const FRESH_TEACHER_RESOURCE_ID_PATTERN = /^ft:(https:\/\/.+)$/s;
const FRESH_TEACHER_ORIGINS = new Set([
  'https://fresh-teacher.github.io',
  'https://s6-fresh-teacher.vercel.app',
  'https://freshteachers.vercel.app',
]);

function responseError(res, status, error) {
  return res.status(status).json({ error });
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validUgandanPhone(value) {
  return /^(?:0\d{9}|256\d{9}|\+256\d{9})$/.test(value.replace(/[\s()-]/g, ''));
}

function normalizePhone(value) {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('256') ? `0${digits.slice(3)}` : digits;
}

function normalizeTransactionId(value) {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

async function submitPayment(req, res) {
  const resourceId = cleanText(req.body && req.body.resourceId);
  const studyHubMatch = STUDY_HUB_RESOURCE_ID_PATTERN.exec(resourceId);
  const freshTeacherMatch = FRESH_TEACHER_RESOURCE_ID_PATTERN.exec(resourceId);
  let deliveryUrl = null;
  if (freshTeacherMatch) {
    try {
      const parsedUrl = new URL(freshTeacherMatch[1]);
      if (FRESH_TEACHER_ORIGINS.has(parsedUrl.origin) && parsedUrl.username === '' && parsedUrl.password === '') {
        deliveryUrl = parsedUrl.href;
      }
    } catch {
      deliveryUrl = null;
    }
  }
  const senderPhone = cleanText(req.body && req.body.senderPhone);
  const transactionId = cleanText(req.body && req.body.transactionId);
  const payerSms = cleanText(req.body && req.body.payerSms);

  if (resourceId.length > 2048 || (!studyHubMatch && !deliveryUrl)) {
    return responseError(res, 400, 'This document is not available for paid download.');
  }
  if (senderPhone.length > 20 || !validUgandanPhone(senderPhone)) {
    return responseError(res, 400, 'Enter a valid Ugandan mobile number.');
  }
  if (!/^[A-Za-z0-9-]{5,100}$/.test(transactionId)) {
    return responseError(res, 400, 'Enter the transaction ID shown in your payment confirmation.');
  }
  if (payerSms.length < 10 || payerSms.length > 5000) {
    return responseError(res, 400, 'Paste the payment confirmation SMS for verification (maximum 5,000 characters).');
  }

  try {
    let resourceTitle = cleanText(req.body && req.body.resourceTitle).slice(0, 500);
    if (studyHubMatch) {
      const resource = await resourceService.getByStoragePath(studyHubMatch[1]);
      if (!resource || !resource.storagePath || !resource.storageBucket) {
        return responseError(res, 404, 'The selected document could not be found.');
      }
      resourceTitle = resource.title || resource.originalFilename || 'Study Hub document';
    } else if (!resourceTitle) {
      resourceTitle = 'Fresh Teacher document';
    }

    const [payment] = await sequelize.query(
      `INSERT INTO public.study_hub_document_payments
         (user_id, resource_id, resource_title, delivery_url, amount_ugx, sender_phone, transaction_id, payer_sms)
       VALUES
         (:userId, :resourceId, :resourceTitle, :deliveryUrl, :amount, :senderPhone, :transactionId, :payerSms)
       RETURNING id, resource_title AS "resourceTitle", amount_ugx AS "amountUgx",
                 status, created_at AS "createdAt"`,
      {
        replacements: {
          userId: req.user.id,
          resourceId,
          resourceTitle,
          deliveryUrl,
          amount: PRICE_UGX,
          senderPhone,
          transactionId,
          payerSms,
        },
        type: QueryTypes.SELECT,
      },
    );

    return res.status(201).json({ payment });
  } catch (error) {
    if (error && error.name === 'SequelizeUniqueConstraintError') {
      return responseError(res, 409, 'That transaction ID has already been submitted.');
    }
    if (error && error.original && error.original.code === '23505') {
      return responseError(res, 409, 'That transaction ID has already been submitted.');
    }
    console.error('Document payment request could not be submitted:', error);
    return responseError(res, 500, 'Your payment request could not be submitted. Please try again.');
  }
}

async function listMyPayments(req, res) {
  try {
    const payments = await sequelize.query(
      `SELECT id, resource_id AS "resourceId", resource_title AS "resourceTitle",
              amount_ugx AS "amountUgx", status, created_at AS "createdAt"
       FROM public.study_hub_document_payments
       WHERE user_id = :userId
       ORDER BY created_at DESC
       LIMIT 100`,
      { replacements: { userId: req.user.id }, type: QueryTypes.SELECT },
    );
    return res.json({ payments });
  } catch (error) {
    console.error('Document payment history could not be loaded:', error);
    return responseError(res, 500, 'Your payment requests could not be loaded.');
  }
}

async function listPaymentsForAdmin(req, res) {
  try {
    const payments = await sequelize.query(
      `SELECT p.id, p.user_id AS "userId", u.email, u.username,
              p.resource_id AS "resourceId", p.resource_title AS "resourceTitle",
              p.delivery_url AS "deliveryUrl",
              p.amount_ugx AS "amountUgx", p.sender_phone AS "senderPhone",
              p.transaction_id AS "transactionId", p.payer_sms AS "payerSms",
              p.status, p.received_sender_phone AS "receivedSenderPhone",
              p.received_recipient_phone AS "receivedRecipientPhone",
              p.received_amount_ugx AS "receivedAmountUgx",
              p.received_transaction_id AS "receivedTransactionId",
              p.received_sms AS "receivedSms", p.verified_at AS "verifiedAt",
              p.created_at AS "createdAt"
       FROM public.study_hub_document_payments AS p
       JOIN public.users AS u ON u.id = p.user_id
       ORDER BY CASE p.status WHEN 'pending' THEN 0 WHEN 'verified' THEN 1 ELSE 2 END,
                p.created_at ASC
       LIMIT 200`,
      { type: QueryTypes.SELECT },
    );
    return res.json({ payments });
  } catch (error) {
    console.error('Admin payment queue could not be loaded:', error);
    return responseError(res, 500, 'The payment queue could not be loaded.');
  }
}

async function tallyPayment(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return responseError(res, 400, 'Invalid payment request.');

  const receivedSenderPhone = cleanText(req.body && req.body.senderPhone);
  const receivedRecipientPhone = cleanText(req.body && req.body.recipientPhone);
  const receivedTransactionId = cleanText(req.body && req.body.transactionId);
  const receivedAmount = Number(req.body && req.body.amountUgx);
  const receivedSms = cleanText(req.body && req.body.receivedSms);

  if (!validUgandanPhone(RECEIVER_PHONE)) {
    console.error('Payment tally unavailable: PAYMENT_RECEIVER_PHONE is invalid.');
    return responseError(res, 503, 'Payment verification is not configured correctly.');
  }
  if (
    receivedSenderPhone.length > 20
    || receivedRecipientPhone.length > 20
    || !validUgandanPhone(receivedSenderPhone)
    || !validUgandanPhone(receivedRecipientPhone)
  ) {
    return responseError(res, 400, 'Enter valid sender and recipient Ugandan mobile numbers.');
  }
  if (!Number.isSafeInteger(receivedAmount) || receivedAmount <= 0) {
    return responseError(res, 400, 'Enter the amount confirmed in the received payment.');
  }
  if (
    !/^[A-Za-z0-9-]{5,100}$/.test(receivedTransactionId)
    || receivedSms.length < 10
    || receivedSms.length > 5000
  ) {
    return responseError(res, 400, 'Enter the received transaction ID and paste the received payment SMS.');
  }

  try {
    const [payment] = await sequelize.query(
      `SELECT sender_phone AS "senderPhone", transaction_id AS "transactionId",
              amount_ugx AS "amountUgx", status
       FROM public.study_hub_document_payments
       WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT },
    );
    if (!payment) return responseError(res, 404, 'Payment request not found.');
    if (payment.status !== 'pending' && payment.status !== 'verified') {
      return responseError(res, 409, 'This payment request is no longer awaiting verification.');
    }

    const mismatches = [];
    if (normalizePhone(receivedSenderPhone) !== normalizePhone(payment.senderPhone)) mismatches.push('sender number');
    if (normalizePhone(receivedRecipientPhone) !== normalizePhone(RECEIVER_PHONE)) mismatches.push('recipient number');
    if (receivedAmount !== Number(payment.amountUgx) || receivedAmount !== PRICE_UGX) mismatches.push('amount');
    if (normalizeTransactionId(receivedTransactionId) !== normalizeTransactionId(payment.transactionId)) {
      mismatches.push('transaction ID');
    }
    if (mismatches.length) {
      return res.status(422).json({ error: `Payment details do not match: ${mismatches.join(', ')}.` });
    }

    const [verified] = await sequelize.query(
      `UPDATE public.study_hub_document_payments
       SET status = 'verified',
           received_sender_phone = :senderPhone,
           received_recipient_phone = :recipientPhone,
           received_amount_ugx = :amount,
           received_transaction_id = :transactionId,
           received_sms = :receivedSms,
           verified_by = :adminId,
           verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = :id AND status IN ('pending', 'verified')
       RETURNING id, status, verified_at AS "verifiedAt"`,
      {
        replacements: {
          id,
          senderPhone: receivedSenderPhone,
          recipientPhone: receivedRecipientPhone,
          amount: receivedAmount,
          transactionId: receivedTransactionId,
          receivedSms,
          adminId: req.user.id,
        },
        type: QueryTypes.SELECT,
      },
    );
    if (!verified) return responseError(res, 409, 'The payment request changed while it was being verified.');
    return res.json({ payment: verified, tallyMatched: true });
  } catch (error) {
    console.error('Payment tally failed:', error);
    return responseError(res, 500, 'Payment details could not be tallied.');
  }
}

async function approvePayment(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return responseError(res, 400, 'Invalid payment request.');

  let payment;
  let signedUrl;
  let emailSent = false;
  try {
    [payment] = await sequelize.query(
      `UPDATE public.study_hub_document_payments AS p
       SET status = 'sending', updated_at = CURRENT_TIMESTAMP
       FROM public.users AS u
       WHERE p.id = :id AND p.user_id = u.id AND p.status = 'verified'
       RETURNING p.id, p.resource_id AS "resourceId", p.resource_title AS "resourceTitle",
       p.delivery_url AS "deliveryUrl",
                 u.email, p.sender_phone AS "senderPhone"`,
      { replacements: { id }, type: QueryTypes.SELECT },
    );
    if (!payment) return responseError(res, 409, 'Tally this payment successfully before approving it.');

    const studyHubMatch = STUDY_HUB_RESOURCE_ID_PATTERN.exec(payment.resourceId);
    const freshTeacherMatch = FRESH_TEACHER_RESOURCE_ID_PATTERN.exec(payment.resourceId);
    if (studyHubMatch) {
      const resource = await resourceService.getByStoragePath(studyHubMatch[1]);
      if (!resource || !resource.storagePath || !resource.storageBucket) {
        throw new Error('The approved document is no longer available in the resource catalog.');
      }
      signedUrl = await resourceService.createSignedUrl(
        resource.storagePath,
        SIGNED_URL_TTL_SECONDS,
        resource.storageBucket,
      );
    } else if (freshTeacherMatch && payment.deliveryUrl) {
      const delivery = new URL(payment.deliveryUrl);
      if (!FRESH_TEACHER_ORIGINS.has(delivery.origin) || delivery.href !== freshTeacherMatch[1]) {
        throw new Error('The approved external document URL is invalid.');
      }
      signedUrl = delivery.href;
    } else {
      throw new Error('The approved resource has an invalid identifier.');
    }
    try {
      await emailService.sendDocumentAccessEmail({
        to: payment.email,
        resourceTitle: payment.resourceTitle,
        signedUrl,
      });
      emailSent = true;
    } catch (emailError) {
      console.error('Document email failed after payment verification:', emailError);
      const [approved] = await sequelize.query(
        `UPDATE public.study_hub_document_payments
         SET status = 'approved', updated_at = CURRENT_TIMESTAMP
         WHERE id = :id AND status = 'sending'
         RETURNING id, status`,
        { replacements: { id }, type: QueryTypes.SELECT },
      );
      if (!approved) throw new Error('Email failed and the approved request status could not be finalized.');
      return res.json({ payment: approved, emailSent: false, directDownloadAvailable: true });
    }
    const [approved] = await sequelize.query(
      `UPDATE public.study_hub_document_payments
       SET status = 'approved', updated_at = CURRENT_TIMESTAMP
       WHERE id = :id AND status = 'sending'
       RETURNING id, status`,
      { replacements: { id }, type: QueryTypes.SELECT },
    );
    if (!approved) throw new Error('The payment email was sent, but the request status could not be finalized.');
    return res.json({ payment: approved, emailSentTo: payment.email });
  } catch (error) {
    if (!emailSent) {
      try {
        await sequelize.query(
          `UPDATE public.study_hub_document_payments
           SET status = 'verified', updated_at = CURRENT_TIMESTAMP
           WHERE id = :id AND status = 'sending'`,
           { replacements: { id }, type: QueryTypes.UPDATE },
        );
      } catch (resetError) {
        console.error('Could not restore payment status after approval failed:', resetError);
      }
    }
    console.error('Payment approval or document email failed:', error);
    return responseError(
      res,
      500,
      emailSent
        ? 'The email was sent, but the request status could not be finalized. Do not retry; contact support.'
        : 'The document could not be emailed. The verified payment remains available to retry.',
    );
  }
}

async function downloadApprovedPayment(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return responseError(res, 400, 'Invalid payment request.');

  try {
    const [payment] = await sequelize.query(
      `SELECT resource_id AS "resourceId", resource_title AS "resourceTitle",
              delivery_url AS "deliveryUrl", status
       FROM public.study_hub_document_payments
       WHERE id = :id AND user_id = :userId`,
      { replacements: { id, userId: req.user.id }, type: QueryTypes.SELECT },
    );
    if (!payment) return responseError(res, 404, 'Payment request not found.');
    if (payment.status !== 'approved') return res.status(202).json({ status: payment.status });

    let deliveryUrl;
    const studyHubMatch = STUDY_HUB_RESOURCE_ID_PATTERN.exec(payment.resourceId);
    const freshTeacherMatch = FRESH_TEACHER_RESOURCE_ID_PATTERN.exec(payment.resourceId);
    if (studyHubMatch) {
      const resource = await resourceService.getByStoragePath(studyHubMatch[1]);
      if (!resource || !resource.storagePath || !resource.storageBucket) {
        return responseError(res, 404, 'The approved document could not be found.');
      }
      deliveryUrl = await resourceService.createSignedUrl(
        resource.storagePath,
        SIGNED_URL_TTL_SECONDS,
        resource.storageBucket,
      );
    } else if (freshTeacherMatch && payment.deliveryUrl) {
      const delivery = new URL(payment.deliveryUrl);
      if (!FRESH_TEACHER_ORIGINS.has(delivery.origin) || delivery.href !== freshTeacherMatch[1]) {
        return responseError(res, 400, 'The approved document URL is invalid.');
      }
      deliveryUrl = delivery.href;
    } else {
      return responseError(res, 400, 'The approved resource identifier is invalid.');
    }

    const upstream = await fetch(deliveryUrl, { signal: AbortSignal.timeout(30_000) });
    if (!upstream.ok || !upstream.body) {
      console.error(`Approved document fetch failed with HTTP ${upstream.status}.`);
      return responseError(res, 502, 'The approved document could not be downloaded right now.');
    }

    const extensionMatch = new URL(deliveryUrl).pathname.match(/\.[A-Za-z0-9]{1,8}$/);
    const extension = extensionMatch ? extensionMatch[0].toLowerCase() : '.pdf';
    const safeTitle = payment.resourceTitle
      .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
      .trim()
      .slice(0, 150) || 'Study Hub document';
    const filename = safeTitle.toLowerCase().endsWith(extension) ? safeTitle : `${safeTitle}${extension}`;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    const contentLength = upstream.headers.get('content-length');
    if (contentLength && /^\d+$/.test(contentLength)) res.setHeader('Content-Length', contentLength);
    Readable.fromWeb(upstream.body).on('error', (error) => {
      console.error('Approved document stream failed:', error);
      if (!res.headersSent) responseError(res, 502, 'The approved document download was interrupted.');
      else res.destroy(error);
    }).pipe(res);
  } catch (error) {
    console.error('Approved document could not be downloaded:', error);
    return responseError(res, 502, 'The approved document could not be downloaded right now.');
  }
}

async function previewPaymentDelivery(req, res) {
  if (process.env.NODE_ENV === 'production' || process.env.PAYMENT_DELIVERY_PREVIEW_ENABLED !== 'true') {
    return responseError(res, 404, 'Development delivery preview is disabled.');
  }

  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return responseError(res, 400, 'Invalid payment request.');

  try {
    const [payment] = await sequelize.query(
      `SELECT resource_id AS "resourceId", delivery_url AS "deliveryUrl"
       FROM public.study_hub_document_payments
       WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT },
    );
    if (!payment) return responseError(res, 404, 'Payment request not found.');

    let deliveryUrl;
    const studyHubMatch = STUDY_HUB_RESOURCE_ID_PATTERN.exec(payment.resourceId);
    const freshTeacherMatch = FRESH_TEACHER_RESOURCE_ID_PATTERN.exec(payment.resourceId);
    if (studyHubMatch) {
      const resource = await resourceService.getByStoragePath(studyHubMatch[1]);
      if (!resource || !resource.storagePath || !resource.storageBucket) {
        return responseError(res, 404, 'The selected document could not be found.');
      }
      deliveryUrl = await resourceService.createSignedUrl(
        resource.storagePath,
        SIGNED_URL_TTL_SECONDS,
        resource.storageBucket,
      );
    } else if (freshTeacherMatch && payment.deliveryUrl) {
      const delivery = new URL(payment.deliveryUrl);
      if (!FRESH_TEACHER_ORIGINS.has(delivery.origin) || delivery.href !== freshTeacherMatch[1]) {
        return responseError(res, 400, 'The external document URL is invalid.');
      }
      deliveryUrl = delivery.href;
    } else {
      return responseError(res, 400, 'The resource identifier is invalid.');
    }

    return res.json({ deliveryUrl, simulated: true });
  } catch (error) {
    console.error('Development delivery preview failed:', error);
    return responseError(res, 500, 'The document preview could not be opened.');
  }
}

async function rejectPayment(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return responseError(res, 400, 'Invalid payment request.');
  try {
    const [payment] = await sequelize.query(
      `UPDATE public.study_hub_document_payments
       SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
       WHERE id = :id AND status IN ('pending', 'verified')
       RETURNING id, status`,
      { replacements: { id }, type: QueryTypes.SELECT },
    );
    if (!payment) return responseError(res, 409, 'This payment request cannot be rejected in its current state.');
    return res.json({ payment });
  } catch (error) {
    console.error('Payment request could not be rejected:', error);
    return responseError(res, 500, 'The payment request could not be rejected.');
  }
}

module.exports = {
  submitPayment,
  listMyPayments,
  listPaymentsForAdmin,
  tallyPayment,
  approvePayment,
  downloadApprovedPayment,
  previewPaymentDelivery,
  rejectPayment,
  PRICE_UGX,
  RECEIVER_PHONE,
  normalizePhone,
};
