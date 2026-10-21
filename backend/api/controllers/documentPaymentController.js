const { QueryTypes } = require('sequelize');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const sequelize = require('../../database/config/database');
const resourceService = require('../../services/resourceService');

const PRICE_UGX = 1000;
const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;
const STUDY_HUB_RESOURCE_ID_PATTERN = /^sh:(.{1,2045})$/s;
const FRESH_TEACHER_RESOURCE_ID_PATTERN = /^ft:(https:\/\/.+)$/s;
const FRESH_TEACHER_ORIGINS = new Set([
  'https://fresh-teacher.github.io',
  'https://s6-fresh-teacher.vercel.app',
  'https://freshteachers.vercel.app',
]);
const RESOURCE_REPOSITORY_ORIGIN = 'https://raw.githubusercontent.com';
const RESOURCE_REPOSITORY_PATH = '/trustjonathan/STUDY-HUB-RESOURCES-1/main/';
const PREMIUM_ARCHIVE_PATH = '/trustjonathan/STUDT-HUB-RESOURCES-2026/main/';

function isSupportedExternalResourceUrl(url) {
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return false;
  return FRESH_TEACHER_ORIGINS.has(url.origin) ||
    (url.origin === RESOURCE_REPOSITORY_ORIGIN &&
      (url.pathname.startsWith(RESOURCE_REPOSITORY_PATH) || url.pathname.startsWith(PREMIUM_ARCHIVE_PATH)));
}

function responseError(res, status, error) {
  return res.status(status).json({ error });
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validUgandanPhone(value) {
  return /^(?:0\d{9}|256\d{9}|\+256\d{9})$/.test(value.replace(/[\s()-]/g, ''));
}

async function submitPayment(req, res) {
  const resourceId = cleanText(req.body && req.body.resourceId);
  const studyHubMatch = STUDY_HUB_RESOURCE_ID_PATTERN.exec(resourceId);
  const freshTeacherMatch = FRESH_TEACHER_RESOURCE_ID_PATTERN.exec(resourceId);
  let deliveryUrl = null;
  if (freshTeacherMatch) {
    try {
      const parsedUrl = new URL(freshTeacherMatch[1]);
      if (isSupportedExternalResourceUrl(parsedUrl)) {
        deliveryUrl = parsedUrl.href;
      }
    } catch {
      deliveryUrl = null;
    }
  }
  const senderPhone = cleanText(req.body && req.body.senderPhone);

  if (resourceId.length > 2048 || (!studyHubMatch && !deliveryUrl)) {
    return responseError(res, 400, 'This document is not available for paid download.');
  }
  if (senderPhone.length > 20 || !validUgandanPhone(senderPhone)) {
    return responseError(res, 400, 'Enter a valid Ugandan mobile number.');
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
         (user_id, resource_id, resource_title, delivery_url, amount_ugx, sender_phone)
       VALUES
         (:userId, :resourceId, :resourceTitle, :deliveryUrl, :amount, :senderPhone)
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
        },
        type: QueryTypes.SELECT,
      },
    );

    return res.status(201).json({ payment });
  } catch (error) {
    console.error('Document payment request could not be submitted:', error);
    return responseError(res, 500, 'Your payment request could not be submitted. Please try again.');
  }
}

async function listMyPayments(req, res) {
  try {
    const payments = await sequelize.query(
      `SELECT id, resource_id AS "resourceId", resource_title AS "resourceTitle",
              amount_ugx AS "amountUgx", sender_phone AS "senderPhone",
              status, created_at AS "createdAt", downloaded_at AS "downloadedAt"
       FROM public.study_hub_document_payments
       WHERE user_id = :userId
       ORDER BY created_at DESC`,
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
              p.status, p.verified_by AS "verifiedBy",
              p.verified_at AS "verifiedAt", p.downloaded_at AS "downloadedAt",
              p.created_at AS "createdAt"
       FROM public.study_hub_document_payments AS p
       JOIN public.users AS u ON u.id = p.user_id
       ORDER BY CASE p.status WHEN 'pending' THEN 0 WHEN 'verified' THEN 1 ELSE 2 END,
                p.created_at ASC`,
      { type: QueryTypes.SELECT },
    );
    return res.json({ payments });
  } catch (error) {
    console.error('Admin payment queue could not be loaded:', error);
    return responseError(res, 500, 'The payment queue could not be loaded.');
  }
}

async function verifyPayment(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return responseError(res, 400, 'Invalid payment request.');

  try {
    const [approved] = await sequelize.query(
      `UPDATE public.study_hub_document_payments
       SET status = 'approved', verified_by = :adminId, verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = :id AND status IN ('pending', 'verified')
       RETURNING id, status, verified_at AS "verifiedAt"`,
      { replacements: { id, adminId: req.user.id }, type: QueryTypes.SELECT },
    );
    if (!approved) return responseError(res, 409, 'This request is not available for verification or has already been used.');
    return res.json({ payment: approved });
  } catch (error) {
    console.error('Payment request could not be verified:', error);
    return responseError(res, 500, 'The request could not be verified. It remains available for review.');
  }
}

async function downloadApprovedPayment(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return responseError(res, 400, 'Invalid payment request.');

  let streamCompleted = false;
  try {
    const [payment] = await sequelize.query(
      `UPDATE public.study_hub_document_payments
       SET status = 'downloading', updated_at = CURRENT_TIMESTAMP
       WHERE id = :id AND user_id = :userId
         AND (status = 'approved' OR (status = 'downloading' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '30 minutes'))
       RETURNING resource_id AS "resourceId", resource_title AS "resourceTitle",
                 delivery_url AS "deliveryUrl"`,
      { replacements: { id, userId: req.user.id }, type: QueryTypes.SELECT },
    );
    if (!payment) {
      const [existing] = await sequelize.query(
        `SELECT status FROM public.study_hub_document_payments
         WHERE id = :id AND user_id = :userId`,
        { replacements: { id, userId: req.user.id }, type: QueryTypes.SELECT },
      );
      if (!existing) return responseError(res, 404, 'Payment request not found.');
      if (['pending', 'verified', 'sending', 'downloading'].includes(existing.status)) {
        return res.status(202).json({ status: existing.status });
      }
      if (existing.status === 'downloaded') return responseError(res, 410, 'This document download has already been used.');
      return responseError(res, 409, 'This request is not available for download.');
    }

    const restoreApproved = async () => sequelize.query(
      `UPDATE public.study_hub_document_payments
       SET status = 'approved', updated_at = CURRENT_TIMESTAMP
       WHERE id = :id AND user_id = :userId AND status = 'downloading'`,
      { replacements: { id, userId: req.user.id }, type: QueryTypes.UPDATE },
    );

    let deliveryUrl;
    const studyHubMatch = STUDY_HUB_RESOURCE_ID_PATTERN.exec(payment.resourceId);
    const freshTeacherMatch = FRESH_TEACHER_RESOURCE_ID_PATTERN.exec(payment.resourceId);
    if (studyHubMatch) {
      const resource = await resourceService.getByStoragePath(studyHubMatch[1]);
      if (!resource || !resource.storagePath || !resource.storageBucket) {
        await restoreApproved();
        return responseError(res, 404, 'The approved document could not be found.');
      }
      deliveryUrl = await resourceService.createSignedUrl(
        resource.storagePath,
        SIGNED_URL_TTL_SECONDS,
        resource.storageBucket,
      );
    } else if (freshTeacherMatch && payment.deliveryUrl) {
      const delivery = new URL(payment.deliveryUrl);
      if (!isSupportedExternalResourceUrl(delivery) || delivery.href !== freshTeacherMatch[1]) {
        await restoreApproved();
        return responseError(res, 400, 'The approved document URL is invalid.');
      }
      deliveryUrl = delivery.href;
    } else {
      await restoreApproved();
      return responseError(res, 400, 'The approved resource identifier is invalid.');
    }

    const upstream = await fetch(deliveryUrl, { signal: AbortSignal.timeout(30_000) });
    if (!upstream.ok || !upstream.body) {
      console.error(`Approved document fetch failed with HTTP ${upstream.status}.`);
      await restoreApproved();
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
    await pipeline(Readable.fromWeb(upstream.body), res);
    streamCompleted = true;
    await sequelize.query(
      `UPDATE public.study_hub_document_payments
       SET status = 'downloaded', downloaded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = :id AND user_id = :userId AND status = 'downloading'`,
      { replacements: { id, userId: req.user.id }, type: QueryTypes.UPDATE },
    );
  } catch (error) {
    console.error('Approved document could not be downloaded:', error);
    if (!streamCompleted) {
      try {
        await sequelize.query(
          `UPDATE public.study_hub_document_payments
           SET status = 'approved', updated_at = CURRENT_TIMESTAMP
           WHERE id = :id AND user_id = :userId AND status = 'downloading'`,
          { replacements: { id, userId: req.user.id }, type: QueryTypes.UPDATE },
        );
      } catch (restoreError) {
        console.error('Could not restore the interrupted document download:', restoreError);
      }
    }
    if (!res.headersSent) return responseError(res, 502, 'The approved document could not be downloaded right now. Retry from your profile.');
    if (!res.destroyed) res.destroy(error);
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
      if (!isSupportedExternalResourceUrl(delivery) || delivery.href !== freshTeacherMatch[1]) {
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
  verifyPayment,
  downloadApprovedPayment,
  previewPaymentDelivery,
  rejectPayment,
  PRICE_UGX,
};
