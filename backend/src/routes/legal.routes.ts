import type { Express, Request, Response } from "express";

type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

type LegalPageDocument = {
  pageLabel: string;
  title: string;
  description: string;
  effectiveDate: string;
  sections: LegalSection[];
  actions?: Array<{
    label: string;
    href: string;
    variant?: "primary" | "secondary";
    external?: boolean;
  }>;
  helperNote?: string;
  privacyNote?: string;
};

type LegalPageSlug = "privacy" | "terms" | "privacy-choices" | "support";

const LEGAL_BASE_URL = "https://api.journalio.app";
const SUPPORT_PAGE_URL = `${LEGAL_BASE_URL}/support`;
const SUPPORT_FORM_URL = "https://forms.gle/Y2WSwrtQCmTXtHLUA";
const EFFECTIVE_DATE = "April 22, 2026";

const legalDocuments: Record<LegalPageSlug, LegalPageDocument> = {
  privacy: {
    pageLabel: "Privacy Policy",
    title: "Journal.IO Privacy Policy",
    description:
      "How Journal.IO collects, uses, stores, and shares information when you use the app and related services.",
    effectiveDate: EFFECTIVE_DATE,
    sections: [
      {
        heading: "Overview",
        paragraphs: [
          "Journal.IO is a behavioral journaling product designed to help users reflect, notice patterns, and build practical habits over time.",
          "This service is not a medical product. Any AI-supported outputs are intended to be supportive, non-clinical, and uncertainty-aware.",
        ],
      },
      {
        heading: "Information We Collect",
        bullets: [
          "Account and profile information such as your name, email address, phone number if provided, sign-in method, onboarding answers, profile image settings, and subscription status.",
          "Journal and wellness-related information such as journal entries, titles, tags, prompts, image references, mood check-ins, reminders, streaks, stats, and derived insights.",
          "Subscription and purchase information such as plan type, entitlement status, purchase source, and restore events.",
          "Technical and operational information such as device or app version information, authentication and security logs, and basic product usage events.",
        ],
      },
      {
        heading: "How We Use Information",
        bullets: [
          "To create and manage your account and keep you signed in.",
          "To provide journaling, mood tracking, reminders, insights, streaks, and related product features.",
          "To personalize prompts, summaries, and app behavior based on your settings and recent activity.",
          "To process premium access, restore purchases, and keep subscription state in sync.",
          "To provide customer support, data export, account deletion, and privacy controls.",
          "To detect, prevent, and investigate security issues, abuse, and misuse.",
          "To improve reliability, product quality, and feature performance.",
        ],
      },
      {
        heading: "AI Processing",
        paragraphs: [
          "When AI-supported features are enabled and available for your account, Journal.IO may use third-party AI providers, including OpenAI, to process limited portions of your journal content and recent-entry context.",
          "We use this processing for features such as prompt generation, tag suggestion, quick reflections, and weekly or trend-based insight summaries.",
          "If AI-supported features are disabled for your account where that control is available, Journal.IO stops using new content for those AI features on a going-forward basis and may clear cached AI summaries linked to that preference.",
        ],
      },
      {
        heading: "When We Share Information",
        paragraphs: [
          "Journal.IO does not sell your personal information or journal content.",
        ],
        bullets: [
          "We may share information with service providers that help us operate the app, such as cloud hosting, authentication, email delivery, subscription management, AI processing, analytics, logging, and operational monitoring vendors.",
          "We may disclose information if reasonably necessary to comply with law, protect rights or safety, or investigate fraud, abuse, or security incidents.",
          "Information may be transferred as part of a merger, acquisition, financing, reorganization, or similar business transaction, subject to applicable law.",
        ],
      },
      {
        heading: "Retention and Security",
        bullets: [
          "We retain account and journal-related data while your account remains active, and longer only as reasonably necessary for legal, security, fraud-prevention, backup, or operational reasons.",
          "If you request account deletion, Journal.IO deletes or de-identifies active production records associated with your account, subject to limited retention obligations.",
          "We use HTTPS and TLS in transit, encrypted or encryption-capable storage controls at rest, authentication and authorization checks, and access controls designed to keep user data isolated by account.",
        ],
      },
      {
        heading: "Your Choices",
        bullets: [
          "You can delete your account from within the app.",
          "You can export your data from within the app where that feature is available for your account tier.",
          "You can manage AI-related privacy settings where that control is available for your account tier.",
          "You can contact Journal.IO to request access, correction, or deletion of your information, subject to applicable law.",
        ],
      },
      {
        heading: "Children's Privacy",
        paragraphs: [
          "Journal.IO is not intended for children who are below the minimum age required to use the service without parental consent under applicable law.",
        ],
      },
      {
        heading: "Contact",
        paragraphs: [
          `If you have questions or requests about privacy or your personal information, please use the Journal.IO support page at ${SUPPORT_PAGE_URL}.`,
        ],
      },
    ],
  },
  terms: {
    pageLabel: "Terms of Service",
    title: "Journal.IO Terms of Service",
    description:
      "The terms that govern use of Journal.IO, including account responsibilities, subscriptions, acceptable use, and important disclaimers.",
    effectiveDate: EFFECTIVE_DATE,
    sections: [
      {
        heading: "Acceptance of Terms",
        paragraphs: [
          "By accessing or using Journal.IO, you agree to these Terms of Service. If you do not agree, do not use the service.",
        ],
      },
      {
        heading: "Eligibility and Accounts",
        bullets: [
          "You are responsible for the accuracy of the account information you provide and for maintaining the confidentiality of your login credentials.",
          "You may not use another person's account or access data that does not belong to you.",
          "Journal.IO is intended for users who are old enough to use the service under applicable law.",
        ],
      },
      {
        heading: "What Journal.IO Provides",
        paragraphs: [
          "Journal.IO provides journaling, mood tracking, reminders, trend summaries, and related reflection tools. Some features may use AI-supported processing when available for your account and app tier.",
          "Journal.IO is not a medical, psychiatric, or crisis-response service. It does not diagnose conditions, provide medical advice, or replace professional care.",
        ],
      },
      {
        heading: "Subscriptions and Billing",
        bullets: [
          "Some Journal.IO features require a paid subscription or one-time purchase.",
          "Subscription billing, renewals, cancellations, and refunds are handled by the platform or payment provider you used to purchase access, such as Apple App Store or Google Play.",
          "Unless stated otherwise by the platform or offer terms, recurring subscriptions renew automatically until canceled through the applicable store account settings.",
          "If offered, lifetime access applies only to the features included in that specific purchase offer and does not guarantee perpetual availability of every future feature.",
        ],
      },
      {
        heading: "Acceptable Use",
        bullets: [
          "Do not use Journal.IO to violate law, infringe rights, abuse the service, or attempt to gain unauthorized access to accounts, systems, or data.",
          "Do not interfere with the normal operation of the service or use automation that places unreasonable load on Journal.IO infrastructure.",
          "Do not reverse engineer, scrape, or misuse the service except as allowed by applicable law.",
        ],
      },
      {
        heading: "Your Content",
        paragraphs: [
          "You retain ownership of the content you submit to Journal.IO. You grant Journal.IO the limited rights needed to host, process, store, and display that content solely to operate and improve the service in line with the Privacy Policy.",
        ],
      },
      {
        heading: "Service Availability and Changes",
        bullets: [
          "Journal.IO may change, suspend, or discontinue parts of the service from time to time.",
          "We may update these terms when the product, legal requirements, or billing model changes. Continued use after an updated version becomes effective means the new terms apply going forward.",
        ],
      },
      {
        heading: "Termination",
        bullets: [
          "You may stop using Journal.IO at any time and can request account deletion using the controls described on the privacy choices page.",
          "Journal.IO may suspend or terminate access if you violate these terms, abuse the service, create legal or security risk, or if continued access is no longer operationally feasible.",
        ],
      },
      {
        heading: "Disclaimers and Limitation of Liability",
        paragraphs: [
          "Journal.IO is provided on an \"as is\" and \"as available\" basis to the fullest extent permitted by law. We do not guarantee uninterrupted availability, error-free operation, or that every feature will always produce accurate or useful output.",
          "To the fullest extent permitted by law, Journal.IO is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages arising from or related to your use of the service.",
        ],
      },
      {
        heading: "Contact",
        paragraphs: [
          `Questions about these terms can be submitted through the Journal.IO support page at ${SUPPORT_PAGE_URL}.`,
        ],
      },
    ],
  },
  "privacy-choices": {
    pageLabel: "Privacy Choices",
    title: "Journal.IO Privacy Choices and Account Deletion",
    description:
      "How to access your data, request deletion, and manage account-level privacy controls for Journal.IO.",
    effectiveDate: EFFECTIVE_DATE,
    sections: [
      {
        heading: "In-App Controls",
        bullets: [
          "Delete account: Open Journal.IO, go to Profile, then Privacy & Data, then Delete Account.",
          "Data export: Open Journal.IO, go to Profile, then Privacy & Data, then Export Your Data if that feature is available for your account tier.",
          "AI privacy setting: Open Journal.IO, go to Settings, then Privacy Mode if that control is available for your account tier.",
        ],
      },
      {
        heading: "Account Deletion",
        paragraphs: [
          "When you request deletion, Journal.IO permanently deletes or de-identifies active production records associated with your account, subject to limited retention required for legal, security, fraud-prevention, backup, or operational reasons.",
          "Temporary deactivation, sign-out, or uninstalling the app does not by itself delete your account.",
        ],
      },
      {
        heading: "Need Help",
        paragraphs: [
          `If you cannot access the app and need help with privacy or deletion, use the Journal.IO support page at ${SUPPORT_PAGE_URL} and include the email address associated with your account.`,
        ],
      },
    ],
  },
  support: {
    pageLabel: "Support",
    title: "Journal.IO Support",
    description:
      "Need help with Journal.IO? Submit a support request and we’ll review it as soon as possible.",
    effectiveDate: EFFECTIVE_DATE,
    sections: [
      {
        heading: "How Support Works",
        paragraphs: [
          "Use the Journal.IO support ticket form to ask for help with account access, subscriptions, app issues, reminders, AI insights, privacy questions, or general feedback.",
          "This page is public and does not require a Journal.IO login.",
        ],
      },
      {
        heading: "Support Categories",
        bullets: [
          "Login or account help",
          "Subscription or billing questions",
          "App bugs or crashes",
          "Journal entry or reminder issues",
          "AI insights or premium feature issues",
          "Privacy or data questions",
          "General feedback",
        ],
      },
      {
        heading: "What Journal.IO Can Help With",
        paragraphs: [
          "We’re here to help with account access, subscriptions, app issues, reminders, AI insights, privacy questions, and general feedback.",
          "Journal.IO can help with product and account questions, but it does not provide medical, psychiatric, or crisis-response support.",
        ],
      },
    ],
    actions: [
      {
        label: "Submit a Support Ticket",
        href: SUPPORT_FORM_URL,
        variant: "primary",
        external: true,
      },
    ],
    helperNote:
      "Please include the email address associated with your Journal.IO account so we can help you faster.",
    privacyNote:
      "Support requests may include your email address and issue details. Please do not include passwords, payment card details, medical information, or private journal entries in your support request.",
  },
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderSection = (section: LegalSection): string => {
  const paragraphs = (section.paragraphs || [])
    .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
  const bullets = section.bullets?.length
    ? `<ul>${section.bullets
        .map(item => `<li>${escapeHtml(item)}</li>`)
        .join("")}</ul>`
    : "";

  return `
    <section>
      <h2>${escapeHtml(section.heading)}</h2>
      ${paragraphs}
      ${bullets}
    </section>
  `;
};

const renderActions = (
  actions: NonNullable<LegalPageDocument["actions"]>
): string => `
  <div class="action-grid">
    ${actions
      .map(action => {
        const target = action.external ? ` target="_blank" rel="noreferrer noopener"` : "";
        const variant = action.variant || "secondary";

        return `<a class="action-button ${variant}" href="${escapeHtml(action.href)}"${target}>${escapeHtml(action.label)}</a>`;
      })
      .join("")}
  </div>
`;

const renderNotes = ({
  helperNote,
  privacyNote,
}: Pick<LegalPageDocument, "helperNote" | "privacyNote">): string => {
  const notes: string[] = [];

  if (helperNote) {
    notes.push(`
      <section class="note-card">
        <h2>Before You Submit</h2>
        <p>${escapeHtml(helperNote)}</p>
      </section>
    `);
  }

  if (privacyNote) {
    notes.push(`
      <section class="note-card warning">
        <h2>Privacy Note</h2>
        <p>${escapeHtml(privacyNote)}</p>
      </section>
    `);
  }

  return notes.join("");
};

const renderLayout = ({
  pageTitle,
  heroTitle,
  description,
  body,
}: {
  pageTitle: string;
  heroTitle: string;
  description: string;
  body: string;
}): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(pageTitle)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f2eb;
        --card: #fffdf9;
        --text: #201914;
        --muted: #65574a;
        --border: #e6d8ca;
        --accent: #e87461;
        --accent-strong: #cf5f4e;
        --accent-soft: #f8e3de;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: radial-gradient(circle at top, #fff9f2 0%, var(--bg) 58%);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.65;
      }

      main {
        max-width: 880px;
        margin: 0 auto;
        padding: 32px 20px 64px;
      }

      .shell {
        background: rgba(255, 253, 249, 0.92);
        border: 1px solid var(--border);
        border-radius: 28px;
        overflow: hidden;
        box-shadow: 0 18px 44px rgba(73, 48, 24, 0.08);
      }

      header {
        padding: 28px 24px 18px;
        border-bottom: 1px solid var(--border);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(250, 244, 237, 0.9));
      }

      nav {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 18px;
      }

      nav a {
        color: var(--accent);
        text-decoration: none;
        font-weight: 600;
        padding: 8px 12px;
        border-radius: 999px;
        background: var(--accent-soft);
      }

      h1 {
        margin: 0;
        font-size: clamp(2rem, 4vw, 2.8rem);
        line-height: 1.1;
      }

      .lede {
        margin: 12px 0 0;
        max-width: 58ch;
        color: var(--muted);
        font-size: 1rem;
      }

      .effective-date {
        display: inline-block;
        margin-top: 16px;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 0.92rem;
        font-weight: 600;
      }

      .content {
        padding: 12px 24px 28px;
      }

      section + section {
        margin-top: 28px;
      }

      h2 {
        margin: 0 0 12px;
        font-size: 1.15rem;
      }

      p,
      li {
        color: var(--muted);
        font-size: 1rem;
      }

      ul {
        margin: 0;
        padding-left: 20px;
      }

      a.inline-link {
        color: var(--accent);
      }

      .footer {
        margin-top: 28px;
        color: var(--muted);
        font-size: 0.92rem;
      }

      .action-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin: 24px 0;
      }

      .action-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 0 18px;
        border-radius: 999px;
        text-decoration: none;
        font-weight: 700;
        transition: transform 140ms ease, box-shadow 140ms ease;
      }

      .action-button:hover {
        transform: translateY(-1px);
      }

      .action-button.primary {
        color: #ffffff;
        background: linear-gradient(180deg, var(--accent), var(--accent-strong));
        box-shadow: 0 16px 30px rgba(232, 116, 97, 0.18);
      }

      .action-button.secondary {
        color: var(--accent);
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid var(--border);
      }

      .note-card {
        margin-top: 18px;
        padding: 16px 18px;
        border-radius: 20px;
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.82);
      }

      .note-card.warning {
        background: #fff7f4;
      }

      .note-card h2 {
        margin-bottom: 8px;
      }

      .note-card p {
        margin: 0;
      }

      .card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
        margin-top: 20px;
      }

      .card {
        display: block;
        text-decoration: none;
        color: inherit;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 18px;
      }

      .card h2 {
        margin-bottom: 8px;
      }

      .card p {
        margin: 0;
      }

      @media (max-width: 640px) {
        main {
          padding: 18px 14px 32px;
        }

        header,
        .content {
          padding-left: 18px;
          padding-right: 18px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <div class="shell">
        <header>
          <nav>
            <a href="/">Legal Hub</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
            <a href="/privacy-choices">Privacy Choices</a>
            <a href="/support">Support</a>
          </nav>
          <h1>${escapeHtml(heroTitle)}</h1>
          <p class="lede">${escapeHtml(description)}</p>
        </header>
        <div class="content">
          ${body}
          <p class="footer">Need help with Journal.IO? Visit <a class="inline-link" href="/support">Support</a>.</p>
        </div>
      </div>
    </main>
  </body>
</html>`;

export const getLegalPageHtml = (slug: LegalPageSlug): string => {
  const document = legalDocuments[slug];
  const sections = document.sections.map(renderSection).join("");
  const actions = document.actions?.length ? renderActions(document.actions) : "";
  const notes = renderNotes(document);
  const body = `
    <div class="effective-date">Effective Date: ${escapeHtml(document.effectiveDate)}</div>
    ${sections}
    ${actions}
    ${notes}
  `;

  return renderLayout({
    pageTitle: document.pageLabel,
    heroTitle: document.title,
    description: document.description,
    body,
  });
};

export const getLegalHubHtml = (): string =>
  renderLayout({
    pageTitle: "Journal.IO Legal",
    heroTitle: "Journal.IO Legal",
    description:
      "Public legal and support pages for app-review and user access, including privacy, terms, account-deletion guidance, and support contact.",
    body: `
      <div class="card-grid">
        <a class="card" href="/privacy">
          <h2>Privacy Policy</h2>
          <p>How Journal.IO collects, uses, stores, and shares app data.</p>
        </a>
        <a class="card" href="/terms">
          <h2>Terms of Service</h2>
          <p>The rules, billing terms, and important disclaimers for using Journal.IO.</p>
        </a>
        <a class="card" href="/privacy-choices">
          <h2>Privacy Choices</h2>
          <p>How to delete an account, export data, and manage privacy controls.</p>
        </a>
        <a class="card" href="/support">
          <h2>Support</h2>
          <p>How to contact Journal.IO for account, billing, privacy, and app help.</p>
        </a>
      </div>
    `,
  });

const sendHtml = (res: Response, html: string) => {
  res.status(200).type("html").send(html);
};

export const registerLegalRoutes = (app: Express): void => {
  app.get("/", (_req: Request, res: Response) => {
    sendHtml(res, getLegalHubHtml());
  });

  app.get("/privacy", (_req: Request, res: Response) => {
    sendHtml(res, getLegalPageHtml("privacy"));
  });

  app.get("/terms", (_req: Request, res: Response) => {
    sendHtml(res, getLegalPageHtml("terms"));
  });

  app.get("/privacy-choices", (_req: Request, res: Response) => {
    sendHtml(res, getLegalPageHtml("privacy-choices"));
  });

  app.get("/account-deletion", (_req: Request, res: Response) => {
    res.redirect(302, "/privacy-choices");
  });

  app.get("/support", (_req: Request, res: Response) => {
    sendHtml(res, getLegalPageHtml("support"));
  });
};
