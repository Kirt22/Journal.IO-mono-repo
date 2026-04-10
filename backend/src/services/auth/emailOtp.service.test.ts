import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  resetSmtpTransportForTests,
  sendEmailVerificationCode,
  setSmtpTransportForTests,
} from "./emailOtp.service";

type CapturedSmtpPayload = {
  host: string;
  port: number;
  username: string;
  password: string;
  fromAddress: string;
  fromName: string;
  replyTo?: string;
  to: string;
  subject: string;
  text: string;
  helloHost: string;
};

const AUTH_EMAIL_ENV_KEYS = [
  "NODE_ENV",
  "AUTH_EMAIL_DELIVERY_MODE",
  "AUTH_EMAIL_OTP_EXPIRES_IN",
  "AUTH_EMAIL_FROM_ADDRESS",
  "AUTH_EMAIL_FROM_NAME",
  "AUTH_EMAIL_REPLY_TO",
  "AUTH_EMAIL_HELO_HOST",
  "RESEND_SMTP_HOST",
  "RESEND_SMTP_PORT",
  "RESEND_SMTP_USERNAME",
  "RESEND_SMTP_PASSWORD",
] as const;

const originalEnv = Object.fromEntries(
  AUTH_EMAIL_ENV_KEYS.map(key => [key, process.env[key]])
) as Record<(typeof AUTH_EMAIL_ENV_KEYS)[number], string | undefined>;

const originalConsoleInfo = console.info;

afterEach(() => {
  resetSmtpTransportForTests();
  console.info = originalConsoleInfo;

  for (const key of AUTH_EMAIL_ENV_KEYS) {
    const originalValue = originalEnv[key];

    if (originalValue === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = originalValue;
  }
});

test("sendEmailVerificationCode falls back to console delivery locally", async () => {
  process.env.NODE_ENV = "development";
  delete process.env.AUTH_EMAIL_DELIVERY_MODE;
  delete process.env.AUTH_EMAIL_FROM_ADDRESS;
  delete process.env.RESEND_SMTP_PASSWORD;

  let loggedMessage = "";
  let smtpWasCalled = false;

  console.info = (message?: unknown, ...optionalParams: unknown[]) => {
    loggedMessage = [message, ...optionalParams].join(" ");
  };
  setSmtpTransportForTests(async () => {
    smtpWasCalled = true;
  });

  await sendEmailVerificationCode({
    email: "alex@example.com",
    code: "123456",
  });

  assert.equal(smtpWasCalled, false);
  assert.match(loggedMessage, /alex@example\.com/);
  assert.match(loggedMessage, /123456/);
});

test("sendEmailVerificationCode uses Resend SMTP when configured", async () => {
  process.env.NODE_ENV = "development";
  delete process.env.AUTH_EMAIL_DELIVERY_MODE;
  process.env.AUTH_EMAIL_FROM_ADDRESS = "no-reply@journal.io";
  process.env.AUTH_EMAIL_FROM_NAME = "Journal.IO";
  process.env.AUTH_EMAIL_REPLY_TO = "support@journal.io";
  process.env.AUTH_EMAIL_HELO_HOST = "api.journal.io";
  process.env.AUTH_EMAIL_OTP_EXPIRES_IN = "15m";
  process.env.RESEND_SMTP_PASSWORD = "re_test_key";

  let capturedPayload: CapturedSmtpPayload | null = null;

  setSmtpTransportForTests(async payload => {
    capturedPayload = payload;
  });

  await sendEmailVerificationCode({
    email: "alex@example.com",
    code: "654321",
  });

  if (!capturedPayload) {
    throw new Error("Expected SMTP transport to be called.");
  }

  const smtpPayload = capturedPayload as CapturedSmtpPayload;

  assert.equal(smtpPayload.host, "smtp.resend.com");
  assert.equal(smtpPayload.port, 465);
  assert.equal(smtpPayload.username, "resend");
  assert.equal(smtpPayload.password, "re_test_key");
  assert.equal(smtpPayload.fromAddress, "no-reply@journal.io");
  assert.equal(smtpPayload.fromName, "Journal.IO");
  assert.equal(smtpPayload.replyTo, "support@journal.io");
  assert.equal(smtpPayload.to, "alex@example.com");
  assert.equal(smtpPayload.helloHost, "api.journal.io");
  assert.match(smtpPayload.subject, /verification code/i);
  assert.match(smtpPayload.text, /654321/);
  assert.match(smtpPayload.text, /15 minutes/);
});

test("sendEmailVerificationCode rejects SMTP mode when required config is missing", async () => {
  process.env.NODE_ENV = "production";
  process.env.AUTH_EMAIL_DELIVERY_MODE = "smtp";
  delete process.env.AUTH_EMAIL_FROM_ADDRESS;
  delete process.env.RESEND_SMTP_PASSWORD;

  await assert.rejects(
    sendEmailVerificationCode({
      email: "alex@example.com",
      code: "123456",
    }),
    /Email verification delivery is not configured/
  );
});
