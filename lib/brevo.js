// brevo.js
const SibApiV3Sdk = require("sib-api-v3-sdk");
require("dotenv").config();

const brevoClient = SibApiV3Sdk.ApiClient.instance;

// 1) Ensure ENV exists at runtime (Heroku Config Var)
const BREVO_KEY = process.env.BREVO_KEY;
if (!BREVO_KEY) {
  // Throw early so you see it in logs
  throw new Error("BREVO_KEY is not set in process.env (Heroku Config Vars).");
}

// 2) Set Transactional API key (not Marketing key)
brevoClient.authentications["api-key"].apiKey = BREVO_KEY;

const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

/**
 * Sends a TRANSACTIONAL TEMPLATE email.
 * Adds strong validation + logs Brevo error bodies if any.
 */
async function sendTemplateEmail({ to, name, templateId, params }) {
  // Basic input validation
  if (!to) throw new Error("sendTemplateEmail: 'to' is required.");
  if (!templateId && templateId !== 0)
    throw new Error("sendTemplateEmail: 'templateId' is required.");

  // 3) Ensure templateId is a number (Brevo expects number)
  const tplId = Number(templateId);
  if (Number.isNaN(tplId))
    throw new Error("sendTemplateEmail: 'templateId' must be a number.");

  const payload = {
    to: [{ email: to, name: name || undefined }],
    templateId: tplId,
    params: params || {},
    // 4) Sender must be a verified “Transactional” sender in Brevo
    sender: {
      email: "info@trellex.com",
      name: "Trellex Support Team",
    },
    // Optional but useful:
    // replyTo: { email: "support@trellex.com", name: "Support" },
    // headers: { "X-Mailin-tag": "trellex-template-send" },
  };

  try {
    const res = await tranEmailApi.sendTransacEmail(payload);
    // Log the messageId for cross-reference in Brevo > Transactional > Logs
    console.log("Brevo sendTransacEmail OK", { messageId: res?.messageId });
    return res;
  } catch (err) {
    // Brevo SDK often puts details in err.response.body
    const details =
      err?.response?.text || err?.response?.body || err?.message || err;
    console.error("Brevo sendTransacEmail ERROR:", details);
    throw err;
  }
}

/**
 * Diagnostic: send a NON-TEMPLATE transactional email.
 * If this arrives, your API key/sender are fine and the issue is your template/params/suppression.
 */
async function sendProbeEmail({ to }) {
  if (!to) throw new Error("sendProbeEmail: 'to' is required.");
  try {
    const res = await tranEmailApi.sendTransacEmail({
      to: [{ email: to }],
      subject: "Brevo Probe (Non-template)",
      htmlContent: `<html><body><p>This is a probe from the API at ${new Date().toISOString()}.</p></body></html>`,
      sender: { email: "info@trellex.com", name: "Trellex Support Team" },
    });
    console.log("Brevo probe OK", { messageId: res?.messageId });
    return res;
  } catch (err) {
    const details =
      err?.response?.text || err?.response?.body || err?.message || err;
    console.error("Brevo probe ERROR:", details);
    throw err;
  }
}

module.exports = { sendTemplateEmail, sendProbeEmail };
