function requiredSetting(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured to email approved documents.`);
  return value;
}

async function sendDocumentAccessEmail({ to, resourceTitle, signedUrl }) {
  const nodemailer = require('nodemailer');
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid port number.');
  }
  const transporter = nodemailer.createTransport({
    host: requiredSetting('SMTP_HOST'),
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: requiredSetting('SMTP_USER'),
      pass: requiredSetting('SMTP_PASSWORD'),
    },
  });
  const from = requiredSetting('SMTP_FROM');
  const safeTitle = String(resourceTitle).replace(/[\r\n]+/g, ' ').slice(0, 500);

  await transporter.sendMail({
    from,
    to,
    subject: `Your Study Hub document: ${safeTitle}`,
    text: `Your payment has been verified. Download "${safeTitle}" using this private link:\n\n${signedUrl}\n\nThis link expires in 7 days.`,
    html: `<p>Your payment has been verified.</p><p>Download <strong>${escapeHtml(safeTitle)}</strong> using the private link below. It expires in 7 days.</p><p><a href="${escapeHtml(signedUrl)}">Download your document</a></p>`,
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

module.exports = { sendDocumentAccessEmail };
