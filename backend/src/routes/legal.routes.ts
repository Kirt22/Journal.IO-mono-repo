import path from "node:path";
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

type LegalPageSlug =
  | "privacy"
  | "terms"
  | "acceptable-use"
  | "privacy-choices"
  | "support";

const LEGAL_BASE_URL = "https://api.journalio.app";
const LANDING_PAGE_BASE_URL = "https://journalio.app";
const API_HOSTNAME = "api.journalio.app";
const WWW_HOSTNAME = "www.journalio.app";
const SUPPORT_PAGE_URL = `${LEGAL_BASE_URL}/support`;
const SUPPORT_FORM_URL = "https://forms.gle/Y2WSwrtQCmTXtHLUA";
const APP_STORE_APP_URL = "https://apps.apple.com/app/id6770075245";
const EFFECTIVE_DATE = "August 8, 2026";

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
          "This service is not a medical product. AI-supported outputs speak directly about patterns in what you write, but they do not diagnose conditions, provide treatment, or advise on medication, and they are not clinical findings.",
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
          "When AI-supported features are available for your account, Journal.IO may use third-party AI providers, including OpenAI, to process limited portions of your journal content and recent-entry context.",
          "We use this processing for features such as prompt generation, tag suggestion, quick reflections, and weekly or trend-based insight summaries.",
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
  "acceptable-use": {
    pageLabel: "Usage Policy",
    title: "Journal.IO Usage Policy",
    description:
      "Guidelines for using Journal.IO safely, respectfully, and in line with the Terms of Service.",
    effectiveDate: EFFECTIVE_DATE,
    sections: [
      {
        heading: "Use Journal.IO Responsibly",
        paragraphs: [
          "Journal.IO is a private space for reflection, mood tracking, and supportive habit-building. Use it only in compliance with applicable law and these guidelines.",
        ],
      },
      {
        heading: "What Is Not Allowed",
        bullets: [
          "Do not use Journal.IO to violate law, infringe another person's rights, harass others, or abuse the service.",
          "Do not access another person's account or data, attempt to bypass security controls, or impersonate another person or organization.",
          "Do not interfere with normal service operation or use automation that creates unreasonable load or security risk.",
          "Do not reverse engineer, scrape, or misuse Journal.IO except where applicable law allows it.",
        ],
      },
      {
        heading: "Support and Safety",
        paragraphs: [
          "Journal.IO is not a medical, psychiatric, therapy, or crisis-response service. Its AI-supported features speak directly and name behavioural and psychological patterns in what you write, but they do not diagnose conditions, provide treatment, advise on medication, or replace professional care.",
          "If you need help with your account or the app, submit a request through the Journal.IO support page. For immediate safety concerns, contact local emergency services or a trusted support person.",
        ],
      },
      {
        heading: "Related Terms",
        paragraphs: [
          "This Usage Policy supplements the Journal.IO Terms of Service. If there is a conflict, the Terms of Service control.",
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
          "Journal previews: Open Journal.IO, go to Settings, then Hide entries if that feature is available for your account tier.",
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
  <div class="doc__actions">
    ${actions
      .map(action => {
        const target = action.external ? ` target="_blank" rel="noreferrer noopener"` : "";
        const variant = action.variant === "primary" ? "btn--app" : "btn--secondary";

        return `<a class="btn ${variant}" href="${escapeHtml(action.href)}"${target}>${escapeHtml(action.label)}</a>`;
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
      <aside class="doc__note">
        <strong>Before You Submit</strong>
        <p>${escapeHtml(helperNote)}</p>
      </aside>
    `);
  }

  if (privacyNote) {
    notes.push(`
      <aside class="doc__note">
        <strong>Privacy Note</strong>
        <p>${escapeHtml(privacyNote)}</p>
      </aside>
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

const APPLE_LOGO_SVG = `<svg viewBox="0 0 384 512" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>`;

const SITE_NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: "/legal", label: "Legal Hub" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy-choices", label: "Your Choices" },
  { href: "/support", label: "Support" },
];

/**
 * Nav and footer are shared with the landing page at backend/public/site/index.html.
 * Keep the markup and class names in sync with backend/public/site/site.css.
 */
const renderSiteNav = (): string => `
    <header class="nav is-stuck" id="nav">
      <div class="nav__inner">
        <a class="wordmark" href="/" aria-label="Journal.IO home">journal<span>.io</span></a>
        <nav class="nav__links" aria-label="Primary">
          ${SITE_NAV_LINKS.map(
            link => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`
          ).join("\n          ")}
        </nav>
        <a class="btn btn--app btn--small nav__cta" href="${APP_STORE_APP_URL}" target="_blank" rel="noreferrer noopener">${APPLE_LOGO_SVG}Download</a>
        <button class="nav__burger" type="button" aria-label="Menu" aria-expanded="false" aria-controls="nav-sheet"><span></span><span></span></button>
      </div>
    </header>
    <div class="nav__sheet" id="nav-sheet" hidden>
      ${SITE_NAV_LINKS.map(
        link => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`
      ).join("\n      ")}
      <a class="btn btn--app" href="${APP_STORE_APP_URL}" target="_blank" rel="noreferrer noopener">${APPLE_LOGO_SVG}Download on the App Store</a>
    </div>`;

const renderSiteFooter = (): string => `
    <footer class="foot">
      <div class="shell">
        <div class="foot__top">
          <div class="foot__brand">
            <a class="wordmark" href="/">journal<span>.io</span></a>
            <p>A calm place to write things down, and a quiet way to notice what keeps coming back.</p>
          </div>
          <div class="foot__col">
            <h4>Product</h4>
            <ul>
              <li><a href="/">Overview</a></li>
              <li><a href="/#features">Features</a></li>
              <li><a href="/#privacy">Privacy</a></li>
              <li><a href="${APP_STORE_APP_URL}" target="_blank" rel="noreferrer noopener">Download</a></li>
            </ul>
          </div>
          <div class="foot__col">
            <h4>Legal</h4>
            <ul>
              <li><a href="/privacy">Privacy Policy</a></li>
              <li><a href="/terms">Terms of Service</a></li>
              <li><a href="/acceptable-use">Usage Policy</a></li>
              <li><a href="/privacy-choices">Privacy Choices</a></li>
              <li><a href="/legal">Legal Hub</a></li>
            </ul>
          </div>
          <div class="foot__col">
            <h4>Support</h4>
            <ul>
              <li><a href="/support">Get help</a></li>
              <li><a href="/privacy-choices">Delete your account</a></li>
              <li><a href="/privacy-choices">Export your data</a></li>
            </ul>
          </div>
        </div>
        <div class="foot__bottom">
          <p>Journal.IO is not a medical device and does not provide medical advice, diagnosis, or treatment. AI-supported reflections speak directly about patterns in your own writing, but they are not clinical findings.</p>
          <p>&copy; 2026 Journal.IO</p>
        </div>
      </div>
    </footer>`;

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
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="theme-color" content="#141210" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:image" content="${LANDING_PAGE_BASE_URL}/assets/site/img/og.jpg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/site/img/icon-32.png" />
    <link rel="apple-touch-icon" href="/assets/site/img/icon-180.png" />
    <link rel="preload" as="font" type="font/woff2" href="/assets/site/fonts/BricolageGrotesque-Bold.woff2" crossorigin />
    <link rel="preload" as="font" type="font/woff2" href="/assets/site/fonts/SchibstedGrotesk-Regular.woff2" crossorigin />
    <link rel="stylesheet" href="/assets/site/site.css" />
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
${renderSiteNav()}
    <main class="doc" id="main">
      <div class="shell">
        <div class="doc__head">
          <p class="overline">Journal.IO</p>
          <h1>${escapeHtml(heroTitle)}</h1>
          <p>${escapeHtml(description)}</p>
        </div>
        <div class="doc__body">
          ${body}
        </div>
      </div>
    </main>
${renderSiteFooter()}
    <script src="/assets/site/site.js" defer></script>
  </body>
</html>`;

export const getLegalPageHtml = (slug: LegalPageSlug): string => {
  const document = legalDocuments[slug];
  const sections = document.sections.map(renderSection).join("");
  const actions = document.actions?.length ? renderActions(document.actions) : "";
  const notes = renderNotes(document);
  const body = `
    <div class="doc__date">Effective Date: ${escapeHtml(document.effectiveDate)}</div>
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

const LEGAL_HUB_ENTRIES: Array<{ href: string; title: string; blurb: string }> = [
  {
    href: "/privacy",
    title: "Privacy Policy",
    blurb: "How Journal.IO collects, uses, stores, and shares app data.",
  },
  {
    href: "/terms",
    title: "Terms of Service",
    blurb: "The rules, billing terms, and important disclaimers for using Journal.IO.",
  },
  {
    href: "/acceptable-use",
    title: "Usage Policy",
    blurb: "Guidelines for using Journal.IO safely and responsibly.",
  },
  {
    href: "/privacy-choices",
    title: "Privacy Choices",
    blurb: "How to delete an account, export data, and manage privacy controls.",
  },
  {
    href: "/support",
    title: "Support",
    blurb: "How to contact Journal.IO for account, billing, privacy, and app help.",
  },
];

export const getLegalHubHtml = (): string =>
  renderLayout({
    pageTitle: "Journal.IO Legal",
    heroTitle: "Journal.IO Legal",
    description:
      "Public legal and support pages for app-review and user access, including privacy, terms, account-deletion guidance, and support contact.",
    body: `
      <ul class="doc__index">
        ${LEGAL_HUB_ENTRIES.map(
          entry => `
        <li>
          <a href="${escapeHtml(entry.href)}">
            <span>
              <h2>${escapeHtml(entry.title)}</h2>
              <p>${escapeHtml(entry.blurb)}</p>
            </span>
            <span class="chev" aria-hidden="true">&rarr;</span>
          </a>
        </li>`
        ).join("")}
      </ul>
    `,
  });

const sendHtml = (res: Response, html: string) => {
  res.status(200).type("html").send(html);
};

/**
 * The marketing landing page is authored as real static files so the CSS and JS
 * are editable and cacheable: backend/public/site/. Resolved the same way as the
 * /assets static mount in app.ts (dist/.. -> backend/public).
 */
const SITE_DIR = path.join(__dirname, "..", "..", "public", "site");

export const LANDING_PAGE_FILE = path.join(SITE_DIR, "index.html");

export const registerLegalRoutes = (app: Express): void => {
  app.get("/", (req: Request, res: Response) => {
    const redirectLocation = getRootRedirectLocationForHost(
      req.get("x-forwarded-host") || req.get("host")
    );

    if (redirectLocation) {
      res.redirect(302, redirectLocation);
      return;
    }

    res.status(200).sendFile(LANDING_PAGE_FILE);
  });

  // crawlers only look for these at the origin root, not under /assets
  app.get("/robots.txt", (_req: Request, res: Response) => {
    res.status(200).type("text/plain").sendFile(path.join(SITE_DIR, "robots.txt"));
  });

  app.get("/sitemap.xml", (_req: Request, res: Response) => {
    res.status(200).type("application/xml").sendFile(path.join(SITE_DIR, "sitemap.xml"));
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

  app.get("/acceptable-use", (_req: Request, res: Response) => {
    sendHtml(res, getLegalPageHtml("acceptable-use"));
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
