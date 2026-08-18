import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  LANDING_PAGE_FILE,
  getLegalHubHtml,
  getLegalPageHtml,
  getRootRedirectLocationForHost,
} from "./legal.routes";

test("the marketing landing page ships as a static file next to the build", () => {
  assert.ok(
    existsSync(LANDING_PAGE_FILE),
    `expected the landing page at ${LANDING_PAGE_FILE}`
  );

  const html = readFileSync(LANDING_PAGE_FILE, "utf8");

  assert.match(html, /Notice what keeps coming back\./);
  assert.match(html, /Download on the App Store/);
  assert.match(html, /https:\/\/apps\.apple\.com\/app\/id6770075245/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/support"/);
  assert.match(html, /href="\/assets\/site\/site\.css"/);
  assert.match(html, /\/assets\/site\/img\/home\.webp/);
  // the non-clinical boundary has to stay on the page
  assert.match(html, /not a medical device/);
});

test("getLegalPageHtml renders the privacy policy page", () => {
  const html = getLegalPageHtml("privacy");

  assert.match(html, /Journal\.IO Privacy Policy/);
  assert.match(html, /href="\/support"/);
  assert.match(html, /href="\/assets\/site\/site\.css"/);
  assert.match(html, /Effective Date: August 8, 2026/);
});

test("legal pages share the landing page shell", () => {
  const html = getLegalPageHtml("terms");

  assert.match(html, /<header class="nav/);
  assert.match(html, /<footer class="foot"/);
  assert.match(html, /journal<span>\.io<\/span>/);
  assert.match(html, /src="\/assets\/site\/site\.js"/);
});

test("getLegalPageHtml renders the terms page", () => {
  const html = getLegalPageHtml("terms");

  assert.match(html, /Journal\.IO Terms of Service/);
  assert.match(html, /Subscriptions and Billing/);
});

test("getLegalPageHtml renders the usage policy page", () => {
  const html = getLegalPageHtml("acceptable-use");

  assert.match(html, /Journal\.IO Usage Policy/);
  assert.match(html, /What Is Not Allowed/);
});

test("getLegalPageHtml renders the support page with the Google Form CTA", () => {
  const html = getLegalPageHtml("support");

  assert.match(html, /Journal\.IO Support/);
  assert.match(html, /Submit a Support Ticket/);
  assert.match(html, /https:\/\/forms\.gle\/Y2WSwrtQCmTXtHLUA/);
  assert.doesNotMatch(html, /View Privacy Policy/);
  assert.doesNotMatch(html, /View Terms of Service/);
});

test("getLegalHubHtml links to every legal route", () => {
  const html = getLegalHubHtml();

  assert.match(html, /Journal\.IO Legal/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/terms"/);
  assert.match(html, /href="\/acceptable-use"/);
  assert.match(html, /href="\/privacy-choices"/);
  assert.match(html, /href="\/support"/);
});

test("getRootRedirectLocationForHost redirects public roots away from API and www hosts", () => {
  assert.equal(
    getRootRedirectLocationForHost("api.journalio.app"),
    "https://journalio.app"
  );
  assert.equal(
    getRootRedirectLocationForHost("www.journalio.app"),
    "https://journalio.app"
  );
  assert.equal(
    getRootRedirectLocationForHost("api.journalio.app:443"),
    "https://journalio.app"
  );
  assert.equal(getRootRedirectLocationForHost("journalio.app"), null);
  assert.equal(getRootRedirectLocationForHost("localhost:3000"), null);
});
