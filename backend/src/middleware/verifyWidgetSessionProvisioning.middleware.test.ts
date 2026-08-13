import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { userModel } from "../schema/user.schema";
import { verifyJwtToken } from "./verifyJwtToken.middleware";
import { verifyWidgetSessionProvisioning } from "./verifyWidgetSessionProvisioning.middleware";

const userTarget = userModel as unknown as {
  findById: (...args: unknown[]) => Promise<unknown>;
};
const originalFindById = userTarget.findById;
const originalJwtSecret = process.env.JWT_ACCESS_SECRET;
const premiumEntitlement = {
  isPremium: true,
  premiumPlanKey: "lifetime",
  premiumSource: "revenuecat_verified",
};

afterEach(() => {
  userTarget.findById = originalFindById;
  if (originalJwtSecret === undefined) {
    delete process.env.JWT_ACCESS_SECRET;
  } else {
    process.env.JWT_ACCESS_SECRET = originalJwtSecret;
  }
});

const buildResponse = () => {
  let statusCode = 200;
  let payload: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(value: unknown) {
      payload = value;
      return response;
    },
  } as unknown as Response;

  return {
    response,
    getPayload: () => payload,
    getStatusCode: () => statusCode,
  };
};

test("a pre-revocation access JWT cannot reach widget session issuance", () => {
  const request = {
    user: { widgetSessionVersion: 1 },
    accessTokenClaims: { widgetSessionVersion: 0 },
  } as Request;
  const { response, getPayload, getStatusCode } = buildResponse();
  let issuanceReached = false;

  verifyWidgetSessionProvisioning(request, response, (() => {
    issuanceReached = true;
  }) as NextFunction);

  assert.equal(getStatusCode(), 401);
  assert.equal(issuanceReached, false);
  assert.deepEqual(getPayload(), {
    success: false,
    message: "Your session has ended. Please sign in again.",
    data: {},
  });
});

test("a newly issued access JWT can provision at the current version", () => {
  const request = {
    method: "POST",
    user: { widgetSessionVersion: 2, ...premiumEntitlement },
    accessTokenClaims: { widgetSessionVersion: 2 },
  } as Request;
  const { response } = buildResponse();
  let issuanceReached = false;

  verifyWidgetSessionProvisioning(request, response, (() => {
    issuanceReached = true;
  }) as NextFunction);

  assert.equal(issuanceReached, true);
});

test("legacy users and access JWTs normalize to version zero", () => {
  const request = {
    method: "POST",
    user: { ...premiumEntitlement },
    accessTokenClaims: { widgetSessionVersion: 0 },
  } as Request;
  const { response } = buildResponse();
  let issuanceReached = false;

  verifyWidgetSessionProvisioning(request, response, (() => {
    issuanceReached = true;
  }) as NextFunction);

  assert.equal(issuanceReached, true);
});

test("free users cannot provision a new interactive widget session", () => {
  const request = {
    method: "POST",
    user: { widgetSessionVersion: 0, isPremium: false },
    accessTokenClaims: { widgetSessionVersion: 0 },
  } as Request;
  const { response, getPayload, getStatusCode } = buildResponse();
  let issuanceReached = false;

  verifyWidgetSessionProvisioning(request, response, (() => {
    issuanceReached = true;
  }) as NextFunction);

  assert.equal(getStatusCode(), 403);
  assert.equal(issuanceReached, false);
  assert.deepEqual(getPayload(), {
    success: false,
    message: "Journal.IO Premium is required for interactive widgets.",
    data: {},
  });
});

test("free users can still revoke a previously issued widget session", () => {
  const request = {
    method: "DELETE",
    user: { widgetSessionVersion: 0, isPremium: false },
    accessTokenClaims: { widgetSessionVersion: 0 },
  } as Request;
  const { response } = buildResponse();
  let revocationReached = false;

  verifyWidgetSessionProvisioning(request, response, (() => {
    revocationReached = true;
  }) as NextFunction);

  assert.equal(revocationReached, true);
});

test("verified pre-revocation JWT is blocked while a current JWT reaches issuance", async () => {
  process.env.JWT_ACCESS_SECRET = "widget-version-test-secret";
  userTarget.findById = async () => ({
    _id: { toString: () => "user-123" },
    widgetSessionVersion: 1,
    ...premiumEntitlement,
  });

  const runMiddlewareChain = async (tokenVersion: number) => {
    const request = {
      method: "POST",
      headers: {
        authorization: `Bearer ${jwt.sign(
          { sub: "user-123", widgetSessionVersion: tokenVersion },
          "widget-version-test-secret"
        )}`,
      },
    } as Request;
    const { response, getStatusCode } = buildResponse();
    let jwtVerified = false;
    let issuanceReached = false;

    await verifyJwtToken(request, response, (() => {
      jwtVerified = true;
    }) as NextFunction);

    if (jwtVerified) {
      verifyWidgetSessionProvisioning(request, response, (() => {
        issuanceReached = true;
      }) as NextFunction);
    }

    return { getStatusCode, issuanceReached, jwtVerified };
  };

  const staleResult = await runMiddlewareChain(0);
  const currentResult = await runMiddlewareChain(1);

  assert.equal(staleResult.jwtVerified, true);
  assert.equal(staleResult.getStatusCode(), 401);
  assert.equal(staleResult.issuanceReached, false);
  assert.equal(currentResult.jwtVerified, true);
  assert.equal(currentResult.issuanceReached, true);
});
