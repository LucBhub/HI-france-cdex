const nodemailer = require("nodemailer");
const axios = require("axios");
const qs = require("qs");

// Environment variables
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const AZURE_SENDER_EMAIL = process.env.AZURE_SENDER_EMAIL;

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

// Setup Nodemailer Transport (Lazy initialization or check on startup)
let smtpTransport = null;

if (SMTP_HOST) {
  smtpTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === "465",
    requireTLS: SMTP_PORT === "587", // Force STARTTLS for port 587
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      ciphers: "SSLv3", // Often helps with O365 compatibility
    },
  });
  console.log("[Email Service] Configured using SMTP.");
}

const { getLocalizedTemplate } = require("./email-templates");

/**
 * Send an email using either Azure Graph API or SMTP.
 * Priority: Azure Graph (if configured) > SMTP.
 *
 * @param {Object} options
 * @param {string} options.to
 * @param {string} [options.subject] - Raw subject (optional if templateKey provided)
 * @param {string} [options.html] - Raw HTML (optional if templateKey provided)
 * @param {string} [options.templateKey] - Key from email-templates.js
 * @param {string} [options.lang] - Language code ('en', 'fr')
 * @param {Object} [options.data] - Data for template functions
 */
async function sendEmail({ to, subject: rawSubject, html: rawHtml, templateKey, lang, data }) {
  let subject = rawSubject;
  let html = rawHtml;

  // Resolve template if key provided
  if (templateKey) {
    try {
      const localized = getLocalizedTemplate(templateKey, lang || "en", data || {});
      subject = localized.subject;
      html = localized.html;
    } catch (err) {
      console.warn(`[Email Service] Template error for ${templateKey}:`, err.message);
      // Fallback to raw if provided, otherwise fail
      if (!subject || !html) throw err;
    }
  }

  // 1. Try Azure Graph API
  if (
    AZURE_TENANT_ID &&
    AZURE_CLIENT_ID &&
    AZURE_CLIENT_SECRET &&
    AZURE_SENDER_EMAIL
  ) {
    try {
      console.log(`[Email Service] Sending via Azure Graph to ${to}...`);
      await sendViaAzureGraph({ to, subject, html });
      console.log("[Email Service] Sent via Azure Graph.");
      return;
    } catch (error) {
      console.error(
        "[Email Service] Failed to send via Azure Graph:",
        error.message,
      );
      if (error.response) {
        console.error(
          "[Email Service] Azure Response:",
          JSON.stringify(error.response.data, null, 2),
        );
      }

      // Fallback to SMTP if configured
      if (smtpTransport) {
        console.warn("[Email Service] Falling back to SMTP...");
      } else {
        throw error; // Re-throw if no fallback
      }
    }
  }

  // 2. Try SMTP
  if (smtpTransport) {
    try {
      console.log(`[Email Service] Sending via SMTP to ${to}...`);
      await smtpTransport.sendMail({
        from: process.env.SMTP_FROM || SMTP_USER || "hyperviseur@reden.solar",
        to,
        subject,
        html,
      });
      console.log("[Email Service] Sent via SMTP.");
      return;
    } catch (error) {
      console.error("[Email Service] Failed to send via SMTP:", error.message);
      throw error;
    }
  }

  console.warn(
    "[Email Service] No email transport configured. Email suppressed.",
  );
}

/**
 * Helper to send via Microsoft Graph API using Client Credentials flow.
 */
async function sendViaAzureGraph({ to, subject, html }) {
  // A. Get Token (Client Credentials)
  const tokenEndpoint = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;
  const tokenResponse = await axios.post(
    tokenEndpoint,
    qs.stringify({
      client_id: AZURE_CLIENT_ID,
      client_secret: AZURE_CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
  );

  const accessToken = tokenResponse.data.access_token;

  // B. Send Mail
  // Endpoint: /users/{sender}/sendMail
  const sendEndpoint = `https://graph.microsoft.com/v1.0/users/${AZURE_SENDER_EMAIL}/sendMail`;

  const emailData = {
    message: {
      subject: subject,
      body: {
        contentType: "HTML",
        content: html,
      },
      toRecipients: [
        {
          emailAddress: {
            address: to,
          },
        },
      ],
    },
    saveToSentItems: false,
  };

  await axios.post(sendEndpoint, emailData, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

module.exports = {
  sendEmail,
};
