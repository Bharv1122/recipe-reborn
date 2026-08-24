/**
 * Transactional email via the Brevo REST API.
 *
 * Deliberately uses plain fetch rather than adding a provider SDK: this repo
 * installs with --legacy-peer-deps (eslint 9 vs @typescript-eslint 7), so every
 * avoided dependency is one less install that can break the Vercel build.
 *
 * Until BREVO_API_KEY is set the sender is a no-op that returns false. Callers
 * must NOT surface that failure to the user — see the forgot-password route for
 * why (leaking "no email sent" would also leak which addresses have accounts).
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export function isEmailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY);
}

/**
 * The address transactional mail is sent from. Brevo requires this sender or
 * domain to be authenticated before delivery to real inboxes will work.
 */
function sender(): { name: string; email: string } {
  const configured = process.env.EMAIL_FROM || 'Recipe Reborn <noreply@mail.recipereborn.com>';
  const match = configured.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);

  if (match) {
    return { name: match[1] || 'Recipe Reborn', email: match[2].trim() };
  }

  return { name: 'Recipe Reborn', email: configured.trim() };
}

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailArgs): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.error(
      '[email] BREVO_API_KEY is not set — skipping send to',
      to,
      '| subject:',
      subject
    );
    return false;
  }

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY as string,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: sender(),
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });

    if (!response.ok) {
      // Body often explains the failure (unverified domain, bad key) — log it,
      // but never let it reach the client.
      const detail = await response.text().catch(() => '');
      console.error('[email] Brevo rejected send:', response.status, detail.slice(0, 500));
      return false;
    }

    return true;
  } catch (error) {
    console.error('[email] Send failed:', error);
    return false;
  }
}

/**
 * Absolute base URL for links inside emails. NEXTAUTH_URL is already required
 * for auth to work in every deployed environment, so reuse it rather than
 * introducing a second URL env var that can drift out of sync.
 */
export function appUrl(): string {
  const raw = process.env.NEXTAUTH_URL || 'https://recipereborn.com';
  return raw.replace(/\/+$/, '');
}

/**
 * Sent a few days before a partner trial lapses.
 *
 * These trials have no card behind them, so nothing converts on its own: if we
 * say nothing, the account quietly drops to the free tier and we never hear
 * from them again. Deliberately not styled as a billing warning — nobody is
 * about to be charged — it is a "here is what you made, want to keep going?"
 */
export function trialEndingEmail(args: {
  offerLabel: string;
  daysLeft: number;
  recipesCreated: number;
  pricingUrl: string;
  feedbackEmail: string;
}) {
  const { offerLabel, daysLeft, recipesCreated, pricingUrl, feedbackEmail } = args;

  const dayPhrase = daysLeft <= 1 ? 'tomorrow' : `in ${daysLeft} days`;
  const madeLine =
    recipesCreated > 0
      ? `You've turned ${recipesCreated} packaged product${recipesCreated === 1 ? '' : 's'} into something fresh so far.`
      : `You haven't generated a recipe yet — there's still time, and it takes about twenty seconds.`;

  const subject = `Your ${offerLabel} free trial ends ${dayPhrase}`;

  const text = [
    `Your ${offerLabel} free trial ends ${dayPhrase}.`,
    '',
    madeLine,
    '',
    'Nothing happens automatically when it ends — we never took a card for the',
    'trial, so there is nothing to cancel and nothing will be charged. Your',
    'account simply moves to the free plan (3 recipes a month) and your saved',
    'recipes stay exactly where they are.',
    '',
    `If you'd like to keep the full 100 a month: ${pricingUrl}`,
    '',
    `And either way I'd genuinely love to know what you thought — just reply, or write to ${feedbackEmail}.`,
  ].join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:22px;color:#065f46;">
        Your ${offerLabel} free trial ends ${dayPhrase}
      </h1>
      <p style="margin:0 0 16px;line-height:1.6;">${madeLine}</p>
      <p style="margin:0 0 16px;line-height:1.6;">
        Nothing happens automatically when it ends — we never took a card for the
        trial, so there is nothing to cancel and nothing will be charged. Your account
        simply moves to the free plan (3 recipes a month), and your saved recipes stay
        exactly where they are.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${pricingUrl}"
           style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
          Keep Premium
        </a>
      </p>
      <p style="margin:0;line-height:1.6;font-size:14px;color:#4b5563;">
        And either way I'd genuinely love to know what you thought — just reply to this
        email, or write to
        <a href="mailto:${feedbackEmail}" style="color:#065f46;">${feedbackEmail}</a>.
      </p>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}

export function passwordResetEmail(resetUrl: string, expiryMinutes: number) {
  const text = [
    'Reset your Recipe Reborn password',
    '',
    'Someone asked to reset the password for this account. Open the link below to choose a new one:',
    resetUrl,
    '',
    `This link expires in ${expiryMinutes} minutes and can only be used once.`,
    "If you didn't request this, you can safely ignore this email — your password won't change.",
  ].join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:22px;color:#065f46;">Reset your password</h1>
      <p style="margin:0 0 16px;line-height:1.6;">
        Someone asked to reset the password for this Recipe Reborn account.
        Choose a new one using the button below.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${resetUrl}"
           style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
          Choose a new password
        </a>
      </p>
      <p style="margin:0 0 16px;line-height:1.6;font-size:14px;color:#4b5563;">
        This link expires in ${expiryMinutes} minutes and can only be used once.
        If the button doesn't work, paste this into your browser:<br>
        <span style="word-break:break-all;color:#065f46;">${resetUrl}</span>
      </p>
      <p style="margin:0;line-height:1.6;font-size:14px;color:#4b5563;">
        If you didn't request this, you can safely ignore this email — your password won't change.
      </p>
    </div>
  </body>
</html>`;

  return { subject: 'Reset your Recipe Reborn password', html, text };
}
