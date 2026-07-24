/**
 * Email sending via SMTP (nodemailer) or Resend HTTP API.
 * Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *  or RESEND_API_KEY (+ SMTP_FROM / RESEND_FROM)
 */
const nodemailer = require('nodemailer');

function fromAddress() {
  return (
    process.env.SMTP_FROM ||
    process.env.RESEND_FROM ||
    process.env.MAIL_FROM ||
    'StoryWeaver <noreply@storyweaver.app>'
  );
}

function isMailConfigured() {
  if (process.env.RESEND_API_KEY) return true;
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendMail({ to, subject, text, html }) {
  const from = fromAddress();
  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    });
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`Resend: ${r.status} ${body}`);
    }
    return;
  }

  if (!process.env.SMTP_HOST) {
    throw new Error('SMTP/Resend not configured');
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465 || process.env.SMTP_SECURE === '1',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({ from, to, subject, text, html });
}

async function sendVerificationEmail({ email, verifyUrl, locale }) {
  const isRu = locale !== 'en';
  const subject = isRu ? 'Подтвердите аккаунт StoryWeaver' : 'Confirm your StoryWeaver account';
  const text = isRu
    ? `Здравствуйте!\n\nЧтобы завершить регистрацию, откройте ссылку:\n${verifyUrl}\n\nСсылка действует 24 часа.\n\nЕсли вы не регистрировались — просто проигнорируйте письмо.`
    : `Hello!\n\nTo finish registration, open this link:\n${verifyUrl}\n\nThe link expires in 24 hours.\n\nIf you did not sign up, ignore this email.`;
  const html = isRu
    ? `<p>Здравствуйте!</p><p>Чтобы завершить регистрацию в <b>StoryWeaver</b>, нажмите кнопку ниже.</p><p><a href="${verifyUrl}" style="display:inline-block;padding:12px 20px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px">Подтвердить email</a></p><p>Или откройте ссылку:<br><a href="${verifyUrl}">${verifyUrl}</a></p><p style="color:#888;font-size:13px">Ссылка действует 24 часа. Если вы не регистрировались — проигнорируйте письмо.</p>`
    : `<p>Hello!</p><p>To finish your <b>StoryWeaver</b> registration, click the button below.</p><p><a href="${verifyUrl}" style="display:inline-block;padding:12px 20px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px">Confirm email</a></p><p>Or open this link:<br><a href="${verifyUrl}">${verifyUrl}</a></p><p style="color:#888;font-size:13px">The link expires in 24 hours. If you did not sign up, ignore this email.</p>`;

  await sendMail({ to: email, subject, text, html });
}

module.exports = { sendMail, sendVerificationEmail, isMailConfigured };
