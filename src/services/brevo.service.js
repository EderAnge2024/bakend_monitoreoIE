// brevo.service.js
// Improved wrapper for Brevo (Sendinblue) Transactional Email API with retries, attachment support, and better config handling.
// Uses native fetch (Node >=18). If fetch is unavailable, falls back to node-fetch.

// Optional dynamic import for fetch in older Node versions
let fetchFn;
(async () => {
  try {
    // Node 18+ provides global fetch
    fetchFn = fetch;
  } catch (e) {
    // Fallback to node-fetch package
    const { default: nodeFetch } = await import('node-fetch');
    fetchFn = nodeFetch;
  }
})();

const BREVO_API_URL = process.env.BREVO_API_URL?.trim() || 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY?.trim();

const DEFAULT_SENDER = {
  name: process.env.BREVO_SENDER_NAME || 'Sistema de Monitoreo IE',
  email: process.env.BREVO_SENDER_EMAIL || 'no-reply@monitoreo.ie',
};

const MAX_RETRIES = 2; // number of additional attempts after the first
const RETRY_BASE_DELAY_MS = 500; // exponential backoff base

/** Helper: pause execution for given milliseconds */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Build the payload object expected by Brevo */
function buildPayload({ to, subject, text, html, attachments = [] }) {
  const payload = {
    sender: DEFAULT_SENDER,
    to: Array.isArray(to) ? to.map((email) => ({ email })) : [{ email: to }],
    subject,
    textContent: text,
    htmlContent: html,
  };

  if (attachments.length) {
    payload.attachment = attachments.map((att) => ({
      name: att.name,
      content: att.content, // base64 string
      type: att.mimeType,
    }));
  }
  return payload;
}

/**
 * Send an email via Brevo Transactional Email API.
 * @param {Object} params - Email parameters.
 * @param {string|string[]} params.to - Recipient email(s).
 * @param {string} params.subject - Subject line.
 * @param {string} params.text - Plain‑text body.
 * @param {string} params.html - HTML body.
 * @param {Array} [params.attachments] - Optional array of { name, content (base64), mimeType }.
 */
async function sendEmail({ to, subject, text, html, attachments }) {
  if (!BREVO_API_KEY) {
    console.warn('[Brevo] BREVO_API_KEY not set – email not sent (simulation).');
    console.log(`[Email Simulado] To: ${to} | Subject: ${subject}`);
    return { simulated: true };
  }

  const payload = buildPayload({ to, subject, text, html, attachments });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchFn(BREVO_API_URL, {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Brevo] Attempt ${attempt + 1} failed with status ${response.status}: ${errorBody}`);
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
          continue;
        }
        throw new Error(`Brevo email error ${response.status}`);
      }

      const data = await response.json();
      console.log('[Brevo] Email sent, messageId:', data.messageId);
      return data;
    } catch (err) {
      console.error(`[Brevo] Network error on attempt ${attempt + 1}:`, err);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      throw err;
    }
  }
}

/** Simple wrapper when you only need to send text+HTML without attachments */
async function simpleSend(to, subject, text, html) {
  return sendEmail({ to, subject, text, html });
}

module.exports = { sendEmail, simpleSend };

