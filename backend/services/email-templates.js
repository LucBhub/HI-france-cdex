/**
 * Email Templates Localization
 */

const templates = {
    FORGOT_PASSWORD: {
        en: {
            subject: "Password Reset Request",
            html: (link) =>
                `<p>You requested a password reset. Click this link to reset your password:</p><a href="${link}">${link}</a>`,
        },
        fr: {
            subject: "Demande de réinitialisation de mot de passe",
            html: (link) =>
                `<p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur ce lien pour le réinitialiser :</p><a href="${link}">${link}</a>`,
        },
    },
    ADMIN_RESET: {
        en: {
            subject: "Admin Requested Password Reset",
            html: (link) =>
                `<p>An administrator has requested a password reset for your account.</p><p>Click here to reset:</p><a href="${link}">${link}</a>`,
        },
        fr: {
            subject: "Réinitialisation de mot de passe demandée par un administrateur",
            html: (link) =>
                `<p>Un administrateur a demandé la réinitialisation du mot de passe de votre compte.</p><p>Cliquez ici pour réinitialiser :</p><a href="${link}">${link}</a>`,
        },
    },
    DECOUPLAGE_ALERT: {
        en: {
            subject: (data) => `⚡ DECOUPLING ALERT — ${data.plantName}`,
            html: (data) => `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #dc2626; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
                        <h2 style="margin: 0;">⚡ Decoupling Detected</h2>
                    </div>
                    <div style="background: #fef2f2; padding: 24px; border: 1px solid #fecaca; border-radius: 0 0 8px 8px;">
                        <p><strong>Plant:</strong> ${data.plantName}</p>
                        <p><strong>Relay ID:</strong> ${data.relayId}</p>
                        <p><strong>Date/Time:</strong> ${data.timeStr}</p>
                        <p style="margin-top: 16px; color: #991b1b;">The circuit breaker has moved to <strong>OPEN</strong> position. Intervention required.</p>
                        <hr style="border: none; border-top: 1px solid #fecaca; margin: 16px 0;">
                        <p style="font-size: 12px; color: #6b7280;">This email was sent automatically by Hyperviseur.</p>
                    </div>
                </div>
            `,
        },
        fr: {
            subject: (data) => `⚡ ALERTE DÉCOUPLAGE — ${data.plantName}`,
            html: (data) => `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #dc2626; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
                        <h2 style="margin: 0;">⚡ Découplage Détecté</h2>
                    </div>
                    <div style="background: #fef2f2; padding: 24px; border: 1px solid #fecaca; border-radius: 0 0 8px 8px;">
                        <p><strong>Centrale :</strong> ${data.plantName}</p>
                        <p><strong>Relay ID :</strong> ${data.relayId}</p>
                        <p><strong>Date/Heure :</strong> ${data.timeStr}</p>
                        <p style="margin-top: 16px; color: #991b1b;">Le disjoncteur est passé en position <strong>OUVERTE</strong>. Intervention requise.</p>
                        <hr style="border: none; border-top: 1px solid #fecaca; margin: 16px 0;">
                        <p style="font-size: 12px; color: #6b7280;">Cet email a été envoyé automatiquement par Hyperviseur.</p>
                    </div>
                </div>
            `,
        },
    },
};

/**
 * Get localized subject and html for a template
 * @param {string} templateKey
 * @param {string} lang ('en', 'fr', etc.)
 * @param {any} data
 */
function getLocalizedTemplate(templateKey, lang, data) {
    const template = templates[templateKey];
    if (!template) throw new Error(`Template ${templateKey} not found`);

    // Fallback to English if language not found
    const localized = template[lang] || template["en"];

    const subject =
        typeof localized.subject === "function"
            ? localized.subject(data)
            : localized.subject;
    const html =
        typeof localized.html === "function"
            ? localized.html(data)
            : localized.html;

    return { subject, html };
}

module.exports = {
    getLocalizedTemplate,
    templates: Object.keys(templates),
};
