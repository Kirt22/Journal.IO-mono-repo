import { Resolver } from "node:dns/promises";

const resolver = new Resolver();

const apiDomain = process.env.PRODUCTION_API_DOMAIN?.trim() || "api.journalio.app";
const apiBaseUrl =
  process.env.PRODUCTION_API_BASE_URL?.trim() || `https://${apiDomain}`;
const mailDomain =
  process.env.PRODUCTION_MAIL_DOMAIN?.trim() || "mail.journalio.app";
const expectedSender =
  process.env.PRODUCTION_EMAIL_FROM_ADDRESS?.trim() || `otp@${mailDomain}`;
const timeoutMs = Number(process.env.PRODUCTION_CHECK_TIMEOUT_MS || "10000");

const results = [];

const pushResult = ({ label, status, detail }) => {
  results.push({ label, status, detail });
};

const printSection = title => {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
};

const formatRecords = records => {
  if (!records || records.length === 0) {
    return "none";
  }

  return JSON.stringify(records);
};

const resolveSafely = async (label, action) => {
  try {
    return await action();
  } catch (error) {
    const code = error && typeof error === "object" ? error.code : "";

    if (code === "ENODATA" || code === "ENOTFOUND" || code === "ESERVFAIL") {
      pushResult({
        label,
        status: "warn",
        detail: code || "No records found",
      });
      return [];
    }

    pushResult({
      label,
      status: "fail",
      detail: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
};

const checkDns = async domain => {
  printSection(`DNS check: ${domain}`);

  const aRecords = await resolveSafely(`${domain} A`, () => resolver.resolve4(domain));
  if (aRecords.length > 0) {
    pushResult({
      label: `${domain} A`,
      status: "pass",
      detail: formatRecords(aRecords),
    });
  }

  const aaaaRecords = await resolveSafely(`${domain} AAAA`, () =>
    resolver.resolve6(domain),
  );
  if (aaaaRecords.length > 0) {
    pushResult({
      label: `${domain} AAAA`,
      status: "pass",
      detail: formatRecords(aaaaRecords),
    });
  }

  const cnameRecords = await resolveSafely(`${domain} CNAME`, () =>
    resolver.resolveCname(domain),
  );
  if (cnameRecords.length > 0) {
    pushResult({
      label: `${domain} CNAME`,
      status: "pass",
      detail: formatRecords(cnameRecords),
    });
  }

  const mxRecords = await resolveSafely(`${domain} MX`, () => resolver.resolveMx(domain));
  if (mxRecords.length > 0) {
    pushResult({
      label: `${domain} MX`,
      status: "pass",
      detail: formatRecords(mxRecords),
    });
  }

  const txtRecords = await resolveSafely(`${domain} TXT`, () =>
    resolver.resolveTxt(domain),
  );
  if (txtRecords.length > 0) {
    pushResult({
      label: `${domain} TXT`,
      status: "pass",
      detail: formatRecords(txtRecords.map(record => record.join(""))),
    });
  }
};

const fetchJson = async url => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    let payload = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      payload,
    };
  } finally {
    clearTimeout(timer);
  }
};

const checkEndpoint = async ({ label, url }) => {
  try {
    const response = await fetchJson(url);
    const isHealthy = response.ok && response.payload?.success === true;

    pushResult({
      label,
      status: isHealthy ? "pass" : "fail",
      detail: JSON.stringify({
        status: response.status,
        payload: response.payload,
      }),
    });
  } catch (error) {
    pushResult({
      label,
      status: "fail",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};

const printResults = () => {
  for (const result of results) {
    console.log(
      `[${result.status.toUpperCase()}] ${result.label}: ${result.detail}`,
    );
  }
};

const summarize = () => {
  const failCount = results.filter(result => result.status === "fail").length;
  const warnCount = results.filter(result => result.status === "warn").length;

  console.log("\nSummary");
  console.log("-------");
  console.log(`Expected sender: ${expectedSender}`);
  console.log(`API base URL: ${apiBaseUrl}`);
  console.log(`Failures: ${failCount}`);
  console.log(`Warnings: ${warnCount}`);

  if (failCount > 0) {
    process.exitCode = 1;
    return;
  }

  if (warnCount > 0) {
    process.exitCode = 0;
    return;
  }

  process.exitCode = 0;
};

await checkDns(apiDomain);
await checkDns(mailDomain);

printSection("HTTP checks");
await checkEndpoint({
  label: `${apiBaseUrl}/health`,
  url: `${apiBaseUrl}/health`,
});
await checkEndpoint({
  label: `${apiBaseUrl}/ready`,
  url: `${apiBaseUrl}/ready`,
});

printSection("Results");
printResults();
summarize();
