import assert from "node:assert/strict";
import test from "node:test";
import { getLegalHubHtml, getLegalPageHtml } from "./legal.routes";

test("getLegalPageHtml renders the privacy policy page", () => {
  const html = getLegalPageHtml("privacy");

  assert.match(html, /Journal\.IO Privacy Policy/);
  assert.match(html, /href="\/support"/);
  assert.match(html, /Effective Date: April 22, 2026/);
});

test("getLegalPageHtml renders the terms page", () => {
  const html = getLegalPageHtml("terms");

  assert.match(html, /Journal\.IO Terms of Service/);
  assert.match(html, /Subscriptions and Billing/);
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

  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/terms"/);
  assert.match(html, /href="\/privacy-choices"/);
  assert.match(html, /href="\/support"/);
});
