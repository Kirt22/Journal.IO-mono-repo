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
const LANDING_PAGE_BASE_URL = "https://journalio.app";
const API_HOSTNAME = "api.journalio.app";
const WWW_HOSTNAME = "www.journalio.app";
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

const normalizeHostname = (hostHeader: string | undefined): string => {
  if (!hostHeader) {
    return "";
  }

  const primaryHost = hostHeader.split(",")[0] || "";

  return primaryHost
    .trim()
    .replace(/:\d+$/, "")
    .toLowerCase();
};

export const getRootRedirectLocationForHost = (
  hostHeader: string | undefined
): string | null => {
  const hostname = normalizeHostname(hostHeader);

  if (hostname === API_HOSTNAME || hostname === WWW_HOSTNAME) {
    return LANDING_PAGE_BASE_URL;
  }

  return null;
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
    <link rel="icon" type="image/png" href="/assets/landing/favicon.png" />
    <link rel="apple-touch-icon" href="/assets/landing/favicon.png" />
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
            <a href="/">Journal.IO</a>
            <a href="/legal">Legal Hub</a>
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

type LandingScreenshot = {
  title: string;
  subtitle: string;
  imageSrc: string;
  fallbackLabel: string;
};

const landingScreenshots: LandingScreenshot[] = [
  {
    title: "Reflect. Track. Grow.",
    subtitle: "Home, streaks, daily mood logging, prompts, and gentle AI insight cards.",
    imageSrc: "/assets/landing/01_reflect_track_grow.png",
    fallbackLabel: "Home dashboard",
  },
  {
    title: "Write freely",
    subtitle: "Quick capture, mood check-ins, writing prompts, manual tags, and AI tag suggestions.",
    imageSrc: "/assets/landing/02_write_freely.png",
    fallbackLabel: "New entry",
  },
  {
    title: "See your patterns",
    subtitle: "Weekly analysis waits for enough signal before turning entries into trend summaries.",
    imageSrc: "/assets/landing/03_see_your_patterns.png",
    fallbackLabel: "AI analysis",
  },
  {
    title: "Stay consistent",
    subtitle: "Streaks, achievements, 30-day activity, and reminders support the journaling habit.",
    imageSrc: "/assets/landing/04_stay_consistent.png",
    fallbackLabel: "Streaks",
  },
  {
    title: "Look back with clarity",
    subtitle: "Calendar history, favorites, search, and tags make older entries easier to revisit.",
    imageSrc: "/assets/landing/05_look_back_with_clarity.png",
    fallbackLabel: "Calendar",
  },
];

const renderLandingScreenshots = (): string =>
  landingScreenshots
    .map(
      screenshot => `
        <article class="showcase-card">
          <img
            src="${escapeHtml(screenshot.imageSrc)}"
            alt="${escapeHtml(screenshot.title)} screenshot"
            loading="lazy"
            onerror="this.closest('.showcase-card').classList.add('image-missing');this.remove();"
          />
          <div class="screenshot-fallback">
            <span>${escapeHtml(screenshot.fallbackLabel)}</span>
          </div>
        </article>
      `
    )
    .join("");

export const getLandingPageHtml = (): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Journal.IO | Reflect. Track. Grow.</title>
    <meta
      name="description"
      content="Journal.IO is a calm behavioral journaling app with mood tracking, streaks, prompts, and gentle AI insights."
    />
    <meta property="og:title" content="Journal.IO | Reflect. Track. Grow." />
    <meta
      property="og:description"
      content="A calm journal with mood tracking, practical streaks, and gentle AI insights."
    />
    <meta property="og:type" content="website" />
    <link rel="icon" type="image/png" href="/assets/landing/favicon.png" />
    <link rel="apple-touch-icon" href="/assets/landing/favicon.png" />
    <style>
      :root {
        color-scheme: light;
        --bg: #fff7ef;
        --ink: #231f1b;
        --muted: #6d6259;
        --soft: #fffdf8;
        --line: rgba(124, 82, 59, 0.16);
        --coral: #ef725f;
        --coral-strong: #d95e4f;
        --coral-soft: #fff0ec;
        --sage: #557665;
        --shadow: 0 24px 80px rgba(100, 54, 25, 0.18);
      }

      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
      }

      body {
        margin: 0;
        color: var(--ink);
        background:
          radial-gradient(circle at 12% 8%, rgba(255, 255, 255, 0.9), transparent 28%),
          radial-gradient(circle at 85% 12%, rgba(255, 218, 190, 0.72), transparent 26%),
          linear-gradient(180deg, #ff795f 0%, #fff2e7 34%, #fffaf4 100%);
        font-family: ui-rounded, "Avenir Next", "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      a {
        color: inherit;
      }

      .page {
        overflow: hidden;
      }

      .nav {
        position: sticky;
        top: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        width: min(1120px, calc(100% - 32px));
        margin: 16px auto 0;
        padding: 12px 14px;
        border: 1px solid rgba(255, 255, 255, 0.45);
        border-radius: 999px;
        background: rgba(255, 250, 244, 0.78);
        box-shadow: 0 16px 44px rgba(83, 43, 22, 0.12);
        backdrop-filter: blur(18px);
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-size: 1rem;
        font-weight: 900;
        text-decoration: none;
      }

      .brand-mark {
        display: grid;
        width: 34px;
        height: 34px;
        place-items: center;
        border-radius: 12px;
        color: #ffffff;
        background: linear-gradient(145deg, var(--coral), #ff9a7a);
        box-shadow: 0 10px 24px rgba(217, 94, 79, 0.28);
      }

      .nav-links {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .nav-links a {
        padding: 9px 13px;
        border-radius: 999px;
        color: rgba(35, 31, 27, 0.76);
        font-size: 0.92rem;
        font-weight: 800;
        text-decoration: none;
      }

      .nav-links a:hover {
        background: rgba(255, 255, 255, 0.76);
      }

      .hero {
        width: min(1120px, calc(100% - 32px));
        margin: 0 auto;
        padding: 92px 0 72px;
        text-align: center;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 38px;
        padding: 0 14px;
        border: 1px solid rgba(255, 255, 255, 0.48);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.32);
        color: #ffffff;
        font-weight: 900;
        box-shadow: 0 14px 30px rgba(117, 55, 25, 0.12);
      }

      .hero h1 {
        max-width: 920px;
        margin: 26px auto 0;
        color: #ffffff;
        font-size: clamp(3.1rem, 9vw, 7.6rem);
        line-height: 0.95;
        letter-spacing: -0.075em;
      }

      .hero .lede {
        max-width: 690px;
        margin: 26px auto 0;
        color: rgba(255, 255, 255, 0.92);
        font-size: clamp(1.18rem, 2.4vw, 1.65rem);
        font-weight: 800;
        line-height: 1.32;
      }

      .hero-actions,
      .hero-pills {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 12px;
        margin-top: 30px;
      }

      .primary-cta,
      .secondary-cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 52px;
        padding: 0 22px;
        border-radius: 999px;
        font-weight: 900;
        text-decoration: none;
      }

      .primary-cta {
        color: var(--coral-strong);
        background: #ffffff;
        box-shadow: 0 18px 46px rgba(105, 48, 22, 0.2);
      }

      .secondary-cta {
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.5);
        background: rgba(255, 255, 255, 0.16);
      }

      .hero-pills {
        margin-top: 24px;
      }

      .pill {
        color: #ffffff;
        font-size: 0.95rem;
      }

      .section {
        width: min(1120px, calc(100% - 32px));
        margin: 0 auto;
        padding: 82px 0;
      }

      .section-header {
        display: grid;
        gap: 12px;
        max-width: 720px;
        margin-bottom: 30px;
      }

      .section-kicker {
        color: var(--coral-strong);
        font-size: 0.82rem;
        font-weight: 950;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .section h2 {
        margin: 0;
        font-size: clamp(2.25rem, 5vw, 4.8rem);
        line-height: 0.98;
        letter-spacing: -0.065em;
      }

      .section-header p,
      .feature-card p,
      .trust-card p,
      .footer p {
        margin: 0;
        color: var(--muted);
        font-size: 1.02rem;
        line-height: 1.65;
      }

      .showcase-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(220px, 1fr));
        gap: 18px;
        overflow-x: auto;
        padding: 8px 4px 26px;
        scroll-snap-type: x mandatory;
      }

      .showcase-card {
        position: relative;
        min-height: 520px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.6);
        border-radius: 34px;
        background:
          radial-gradient(circle at 50% 10%, rgba(255, 255, 255, 0.5), transparent 30%),
          linear-gradient(180deg, #ff7a61 0%, #ffc397 100%);
        box-shadow: var(--shadow);
        scroll-snap-align: center;
      }

      .showcase-card img {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 520px;
        object-fit: cover;
      }

      .screenshot-fallback {
        display: none;
        min-height: 420px;
        align-items: flex-end;
        justify-content: center;
        padding: 32px 22px;
      }

      .screenshot-fallback span {
        display: grid;
        width: 168px;
        height: 330px;
        place-items: center;
        border: 8px solid #24211f;
        border-radius: 38px;
        background: linear-gradient(180deg, #fffdf9, #f8eee6);
        color: var(--coral-strong);
        font-weight: 950;
        text-align: center;
        box-shadow: 0 22px 44px rgba(82, 44, 24, 0.26);
      }

      .showcase-card.image-missing .screenshot-fallback {
        display: flex;
      }

      .feature-grid,
      .trust-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
      }

      .feature-card,
      .trust-card {
        min-height: 220px;
        padding: 24px;
        border: 1px solid var(--line);
        border-radius: 28px;
        background: rgba(255, 253, 248, 0.86);
        box-shadow: 0 18px 54px rgba(87, 51, 29, 0.08);
      }

      .feature-card strong,
      .trust-card strong {
        display: block;
        margin-bottom: 12px;
        font-size: 1.2rem;
      }

      .feature-card span,
      .trust-card span {
        display: grid;
        width: 42px;
        height: 42px;
        margin-bottom: 18px;
        place-items: center;
        border-radius: 15px;
        color: var(--coral-strong);
        background: var(--coral-soft);
        font-weight: 950;
      }

      .split {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(280px, 0.76fr);
        gap: 26px;
        align-items: stretch;
      }

      .founder-note {
        padding: 30px;
        border-radius: 34px;
        background: linear-gradient(145deg, #2d251f, #4d3128);
        color: #fff7ef;
        box-shadow: var(--shadow);
      }

      .founder-note h2 {
        color: #ffffff;
      }

      .founder-note p {
        color: rgba(255, 247, 239, 0.78);
      }

      .waitlist-card {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 20px;
        padding: 30px;
        border-radius: 34px;
        background: linear-gradient(180deg, #ffffff, #fff1eb);
        border: 1px solid rgba(217, 94, 79, 0.18);
        box-shadow: 0 20px 64px rgba(100, 54, 25, 0.12);
      }

      .waitlist-card h3 {
        margin: 0;
        font-size: 2rem;
        letter-spacing: -0.04em;
      }

      .waitlist-card p {
        margin: 0;
        color: var(--muted);
        line-height: 1.65;
      }

      .footer {
        width: min(1120px, calc(100% - 32px));
        margin: 0 auto;
        padding: 38px 0 54px;
        border-top: 1px solid var(--line);
      }

      .footer-row {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 18px;
      }

      .footer-links {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .footer-links a {
        color: var(--muted);
        font-weight: 800;
        text-decoration: none;
      }

      @media (max-width: 840px) {
        .nav {
          align-items: flex-start;
          border-radius: 28px;
        }

        .nav-links {
          display: none;
        }

        .hero {
          padding-top: 58px;
        }

        .feature-grid,
        .trust-grid,
        .split {
          grid-template-columns: 1fr;
        }

        .showcase-grid {
          grid-template-columns: repeat(5, minmax(250px, 78vw));
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <nav class="nav" aria-label="Primary navigation">
        <a class="brand" href="/">
          <span class="brand-mark">J</span>
          <span>Journal.IO</span>
        </a>
        <div class="nav-links">
          <a href="#showcase">Screens</a>
          <a href="#features">Features</a>
          <a href="#privacy">Privacy</a>
          <a href="/support">Support</a>
        </div>
      </nav>

      <header class="hero">
        <h1>Reflect. Track. Grow.</h1>
        <p class="lede">
          Journal.IO helps you capture daily thoughts, track moods, build streaks, and notice recurring patterns with gentle AI insights.
        </p>
        <div class="hero-actions">
          <a class="primary-cta" href="#showcase">See the app</a>
          <a class="secondary-cta" href="/privacy">Read privacy policy</a>
        </div>
        <div class="hero-pills" aria-label="Product highlights">
          <span class="pill">Mood tracking</span>
          <span class="pill">Weekly insights</span>
          <span class="pill">Private by design</span>
        </div>
      </header>

      <section id="showcase" class="section" aria-labelledby="showcase-heading">
        <div class="section-header">
          <span class="section-kicker">App Preview</span>
          <h2 id="showcase-heading">A journal that turns writing into patterns.</h2>
          <p>
            From quick capture to weekly analysis, the app stays focused on one calm loop: write honestly, check in, and notice what keeps showing up.
          </p>
        </div>
        <div class="showcase-grid">
          ${renderLandingScreenshots()}
        </div>
      </section>

      <section id="features" class="section" aria-labelledby="features-heading">
        <div class="section-header">
          <span class="section-kicker">Core Loop</span>
          <h2 id="features-heading">Everything supports the daily habit.</h2>
          <p>
            Journal.IO keeps the product simple: write, check in, review what changed, and carry one small next step forward.
          </p>
        </div>
        <div class="feature-grid">
          <article class="feature-card">
            <span>01</span>
            <strong>Write without friction</strong>
            <p>Quick capture, prompts, mood selection, manual tags, and premium AI tag suggestions keep entries lightweight.</p>
          </article>
          <article class="feature-card">
            <span>02</span>
            <strong>Review real patterns</strong>
            <p>Insights are based on saved entries, mood check-ins, topics, streaks, and enough weekly activity to avoid forced conclusions.</p>
          </article>
          <article class="feature-card">
            <span>03</span>
            <strong>Stay consistent</strong>
            <p>Streaks, reminders, calendar history, favorites, and gentle progress states keep users returning without noisy gamification.</p>
          </article>
        </div>
      </section>

      <section id="privacy" class="section" aria-labelledby="privacy-heading">
        <div class="section-header">
          <span class="section-kicker">Trust</span>
          <h2 id="privacy-heading">Supportive, non-clinical, and privacy-conscious.</h2>
          <p>
            Journal.IO is for reflection and behavior awareness. It is not a medical, therapy, or crisis-response product, and AI copy stays uncertainty-aware.
          </p>
        </div>
        <div class="trust-grid">
          <article class="trust-card">
            <span>AI</span>
            <strong>Gentle AI insights</strong>
            <p>Weekly analysis and quick reads use soft language like “may indicate” and “journal entries suggest.”</p>
          </article>
          <article class="trust-card">
            <span>PV</span>
            <strong>User-controlled privacy</strong>
            <p>Premium privacy controls include AI opt-out, hidden journal previews, data export, and account deletion paths.</p>
          </article>
          <article class="trust-card">
            <span>SF</span>
            <strong>Safety-first handling</strong>
            <p>Elevated-risk writing is routed to support-first messaging instead of normal trait or pattern interpretation.</p>
          </article>
        </div>
      </section>

      <section class="section split" aria-labelledby="founder-heading">
        <div class="founder-note">
          <span class="section-kicker">Founder Built</span>
          <h2 id="founder-heading">Built in public, one vertical slice at a time.</h2>
          <p>
            Journal.IO was built with product docs, AI-agent workflows, Figma-to-code implementation, backend contracts, safety guardrails, and release-readiness tracking.
          </p>
        </div>
        <aside class="waitlist-card">
          <div>
            <h3>Coming soon</h3>
            <p>Journal.IO is preparing for App Store launch. Follow the build, review the public policies, or contact support for questions.</p>
          </div>
          <a class="primary-cta" href="/support">Contact support</a>
        </aside>
      </section>

      <footer class="footer">
        <div class="footer-row">
          <p>Journal.IO helps users reflect, track moods, and notice recurring behavior patterns over time.</p>
          <div class="footer-links">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/privacy-choices">Privacy Choices</a>
            <a href="/support">Support</a>
            <a href="/legal">Legal Hub</a>
          </div>
        </div>
      </footer>
    </div>
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
  app.get("/", (req: Request, res: Response) => {
    const redirectLocation = getRootRedirectLocationForHost(
      req.get("x-forwarded-host") || req.get("host")
    );

    if (redirectLocation) {
      res.redirect(302, redirectLocation);
      return;
    }

    sendHtml(res, getLandingPageHtml());
  });

  app.get("/legal", (_req: Request, res: Response) => {
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
