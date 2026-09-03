import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "./app";

const originalNodeEnv = process.env.NODE_ENV;
const originalReleaseSha = process.env.RELEASE_SHA;
let server: Server | null = null;
let baseUrl: string;

before(async () => {
  process.env.NODE_ENV = "production";
  process.env.RELEASE_SHA = "readiness-test-sha";

  const app = createApp();
  server = await new Promise<Server>((resolve, reject) => {
    const listening = app.listen(0, "127.0.0.1", (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(listening);
    });
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close(error => (error ? reject(error) : resolve()));
    });
  }

  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalReleaseSha === undefined) delete process.env.RELEASE_SHA;
  else process.env.RELEASE_SHA = originalReleaseSha;
});

test("health responses include release identity and production headers", async () => {
  const response = await fetch(`${baseUrl}/health`, {
    headers: { "x-request-id": "readiness-request" },
  });
  const payload = (await response.json()) as {
    success: boolean;
    data: { releaseSha: string | null };
  };

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.releaseSha, "readiness-test-sha");
  assert.equal(response.headers.get("x-request-id"), "readiness-request");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-security-policy") ?? "", /default-src/);
  assert.ok(response.headers.get("strict-transport-security"));
  assert.equal(response.headers.get("x-powered-by"), null);
});

test("CORS accepts the production site and native requests", async () => {
  const webResponse = await fetch(`${baseUrl}/health`, {
    headers: { origin: "https://journalio.app" },
  });
  const nativeResponse = await fetch(`${baseUrl}/health`);

  assert.equal(webResponse.status, 200);
  assert.equal(
    webResponse.headers.get("access-control-allow-origin"),
    "https://journalio.app"
  );
  assert.equal(nativeResponse.status, 200);
});

test("CORS rejects unknown browser origins with the standard error shape", async () => {
  const response = await fetch(`${baseUrl}/health`, {
    headers: { origin: "https://untrusted.example" },
  });
  const payload = (await response.json()) as {
    success: boolean;
    message: string;
    error: { requestId?: string };
  };

  assert.equal(response.status, 403);
  assert.equal(payload.success, false);
  assert.equal(typeof payload.message, "string");
  assert.equal(typeof payload.error.requestId, "string");
});

test("auth initiation limits return a standard 429 response", async () => {
  let response: Response | null = null;

  for (let index = 0; index < 21; index += 1) {
    response = await fetch(`${baseUrl}/api/v1/auth/sign_in_with_email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
  }

  assert.equal(response?.status, 429);
  const payload = (await response?.json()) as {
    success: boolean;
    message: string;
    error: Record<string, unknown>;
  };
  assert.equal(payload.success, false);
  assert.match(payload.message, /too many requests/i);
  assert.deepEqual(payload.error, {});
});
