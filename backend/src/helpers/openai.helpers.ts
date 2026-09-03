import { z } from "zod";
import { userModel } from "../schema/user.schema";
import { hasActivePremiumEntitlement } from "./premiumEntitlement.helpers";
import { buildSafeErrorLog, getSafeErrorCode } from "./safeLogging.helpers";

type OpenAiInputMessage = {
  role: "system" | "user";
  content: string;
};

type StructuredOpenAiRequest<T> = {
  feature: string;
  schemaName: string;
  schema: Record<string, unknown>;
  parser: z.ZodType<T>;
  messages: OpenAiInputMessage[];
  maxOutputTokens?: number;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high" | "xhigh" | "max";
};

type OpenAiResponseContent = {
  text?: string;
  type?: string;
};

type OpenAiResponseOutput = {
  content?: OpenAiResponseContent[];
};

type OpenAiApiResponse = {
  id?: string;
  model?: string;
  status?: string;
  incomplete_details?: { reason?: string } | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  output_text?: string;
  output?: OpenAiResponseOutput[];
};

export type StructuredOpenAiFailure =
  | "not_configured"
  | "request_failed"
  | "incomplete"
  | "empty_output"
  | "invalid_json"
  | "schema_validation_failed"
  | "exception";

export type StructuredOpenAiResult<T> =
  { data: T; failure: null } | { data: null; failure: StructuredOpenAiFailure };

export type OpenAiCallAuditEvent = {
  kind: "structured" | "embedding";
  feature: string;
  schemaName: string | null;
  model: string;
  outcome: "success" | "failure";
  failure: StructuredOpenAiFailure | "http_error" | "invalid_vectors" | null;
  responseId: string | null;
};

type OpenAiCallAuditObserver = (event: OpenAiCallAuditEvent) => void;

let openAiCallAuditObserver: OpenAiCallAuditObserver | null = null;

const emitOpenAiCallAudit = (event: OpenAiCallAuditEvent) => {
  try {
    openAiCallAuditObserver?.(event);
  } catch {
    // Capture diagnostics must never alter the product AI path.
  }
};

const registerOpenAiCallAuditObserver = (
  observer: OpenAiCallAuditObserver | null,
) => {
  openAiCallAuditObserver = observer;
};

/**
 * Status codes worth trying again: rate limiting, request timeout, and the
 * transient 5xx family. Everything else is a real answer, including 4xx, which
 * would fail identically on a retry.
 */
const TRANSIENT_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);
const TRANSIENT_RETRY_DELAYS_MS = [500, 1500];

/**
 * A 429 usually means "too fast, try again", but the same status is also how the
 * API reports an exhausted credit balance — and that one will never clear inside
 * a retry window. Waiting it out three times per call turns a billing problem
 * into minutes of dead time on a batch job, so it is treated as a real answer.
 */
const isQuotaExhausted429 = async (response: Response): Promise<boolean> => {
  if (response.status !== 429) {
    return false;
  }

  try {
    const body = (await response.clone().json()) as {
      error?: { type?: string; code?: string };
    };
    const type = body?.error?.type || "";
    const code = body?.error?.code || "";
    return type === "insufficient_quota" || code === "credit_balance_exhausted";
  } catch {
    // An unreadable body tells us nothing; fall back to treating it as transient.
    return false;
  }
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * fetch, with a bounded retry for failures that are about the connection rather
 * than the request. Node throws a TypeError ("fetch failed") when a socket drops,
 * and without this a single blip costs the caller its whole AI result: the entry
 * silently falls back to generic copy, and a long batch job dies outright.
 *
 * Deliberately narrow — it retries transport, never a response the API meant to
 * send. Retrying a schema-validation failure or a truncated response would just
 * spend the same money twice on the same answer.
 */
const fetchWithTransientRetry = async (
  url: string,
  init: RequestInit,
  feature: string,
): Promise<Response> => {
  let lastError: unknown = null;

  for (
    let attempt = 0;
    attempt <= TRANSIENT_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    if (attempt > 0) {
      await sleep(TRANSIENT_RETRY_DELAYS_MS[attempt - 1]!);
    }

    try {
      const response = await fetch(url, init);
      if (
        !TRANSIENT_STATUSES.has(response.status) ||
        attempt === TRANSIENT_RETRY_DELAYS_MS.length ||
        (await isQuotaExhausted429(response))
      ) {
        return response;
      }
      console.warn(
        buildSafeErrorLog({
          event: "openai.responses.transient_retry",
          fieldPath: feature,
          status: response.status,
          code: `http_${response.status}`,
          metadata: { attempt: attempt + 1 },
        }),
      );
    } catch (error) {
      lastError = error;
      if (attempt === TRANSIENT_RETRY_DELAYS_MS.length) {
        throw error;
      }
      console.warn(
        buildSafeErrorLog({
          event: "openai.responses.transient_retry",
          fieldPath: feature,
          code: getSafeErrorCode(error),
          metadata: { attempt: attempt + 1 },
        }),
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("OpenAI request failed after retries.");
};

const getOpenAiApiKey = () => process.env.OPENAI_API_KEY?.trim() || "";
const getOpenAiModel = () =>
  process.env.OPENAI_RESPONSES_MODEL?.trim() ||
  process.env.OPENAI_MODEL?.trim() ||
  "gpt-5.4-mini";
const getOpenAiEmbeddingModel = () =>
  process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
const shouldLogOpenAiDebug =
  process.env.NODE_ENV !== "production" &&
  process.env.OPENAI_DEBUG_LOGS === "true";

const isOpenAiConfigured = () => Boolean(getOpenAiApiKey());

type UserAiAccessState = {
  isPremium: boolean;
};

const getUserAiAccessState = async (
  userId: string,
): Promise<UserAiAccessState> => {
  const user = await userModel
    .findById(userId)
    .select("isPremium premiumPlanKey premiumExpiresAt premiumSource")
    .lean()
    .exec();

  return {
    isPremium: hasActivePremiumEntitlement(user),
  };
};

const canUseOpenAiForUser = async (userId: string) => {
  if (!isOpenAiConfigured()) {
    return false;
  }

  const accessState = await getUserAiAccessState(userId);
  return accessState.isPremium;
};

const readOpenAiOutputText = (payload: OpenAiApiResponse) => {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  for (const item of payload.output || []) {
    for (const contentItem of item.content || []) {
      if (typeof contentItem.text === "string" && contentItem.text.trim()) {
        return contentItem.text.trim();
      }
    }
  }

  return "";
};

const requestStructuredOpenAiDetailed = async <T>({
  feature,
  schemaName,
  schema,
  parser,
  messages,
  maxOutputTokens = 900,
  model,
  reasoningEffort,
}: StructuredOpenAiRequest<T>): Promise<StructuredOpenAiResult<T>> => {
  const resolvedModel = model?.trim() || getOpenAiModel();

  if (!isOpenAiConfigured()) {
    emitOpenAiCallAudit({
      kind: "structured",
      feature,
      schemaName,
      model: resolvedModel,
      outcome: "failure",
      failure: "not_configured",
      responseId: null,
    });
    return { data: null, failure: "not_configured" };
  }

  try {
    const response = await fetchWithTransientRetry(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getOpenAiApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: resolvedModel,
          store: false,
          input: messages,
          max_output_tokens: maxOutputTokens,
          ...(reasoningEffort
            ? { reasoning: { effort: reasoningEffort } }
            : {}),
          text: {
            format: {
              type: "json_schema",
              name: schemaName,
              strict: true,
              schema,
            },
          },
        }),
      },
      feature,
    );

    if (!response.ok) {
      emitOpenAiCallAudit({
        kind: "structured",
        feature,
        schemaName,
        model: resolvedModel,
        outcome: "failure",
        failure: "http_error",
        responseId: null,
      });
      console.error(
        buildSafeErrorLog({
          event: "openai.responses.request_failed",
          fieldPath: feature,
          status: response.status,
          code: `http_${response.status}`,
        }),
      );
      return { data: null, failure: "request_failed" };
    }

    const payload = (await response.json()) as OpenAiApiResponse;
    const outputText = readOpenAiOutputText(payload);
    const responseMetadata = {
      responseId: payload.id || null,
      model: payload.model || resolvedModel,
      status: payload.status || null,
      incompleteReason: payload.incomplete_details?.reason || null,
      usage: payload.usage || null,
    };

    if (shouldLogOpenAiDebug) {
      console.log(`[OpenAI] ${feature} response metadata`, {
        schemaName,
        ...responseMetadata,
      });
    }

    if (payload.status === "incomplete") {
      emitOpenAiCallAudit({
        kind: "structured",
        feature,
        schemaName,
        model: responseMetadata.model,
        outcome: "failure",
        failure: "incomplete",
        responseId: responseMetadata.responseId,
      });
      console.error(
        buildSafeErrorLog({
          event: "openai.responses.incomplete",
          fieldPath: feature,
          code: payload.incomplete_details?.reason || "incomplete",
          metadata: responseMetadata,
        }),
      );
      return { data: null, failure: "incomplete" };
    }

    if (!outputText) {
      emitOpenAiCallAudit({
        kind: "structured",
        feature,
        schemaName,
        model: responseMetadata.model,
        outcome: "failure",
        failure: "empty_output",
        responseId: responseMetadata.responseId,
      });
      console.error(
        buildSafeErrorLog({
          event: "openai.responses.empty_output",
          fieldPath: feature,
          code: "empty_output",
        }),
      );
      return { data: null, failure: "empty_output" };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(outputText);
    } catch {
      emitOpenAiCallAudit({
        kind: "structured",
        feature,
        schemaName,
        model: responseMetadata.model,
        outcome: "failure",
        failure: "invalid_json",
        responseId: responseMetadata.responseId,
      });
      console.error(
        buildSafeErrorLog({
          event: "openai.responses.invalid_json",
          fieldPath: feature,
          code: "invalid_json",
          metadata: responseMetadata,
        }),
      );
      return { data: null, failure: "invalid_json" };
    }
    const parsed = parser.safeParse(parsedJson);

    if (!parsed.success) {
      emitOpenAiCallAudit({
        kind: "structured",
        feature,
        schemaName,
        model: responseMetadata.model,
        outcome: "failure",
        failure: "schema_validation_failed",
        responseId: responseMetadata.responseId,
      });
      console.error(
        buildSafeErrorLog({
          event: "openai.responses.schema_validation_failed",
          fieldPath: feature,
          code: "schema_validation_failed",
          // Which fields failed and why, never what they contained. Without
          // this a rejected response is indistinguishable from an outage, and
          // the usual cause — the JSON schema sent to the model carrying no
          // bound that the Zod parser then enforces — is invisible.
          // Flattened to a single string on purpose: console.error stops
          // expanding at depth 2 and would print "issues: [ [Object] ]",
          // which is no more useful than no diagnostic at all.
          metadata: {
            issues: parsed.error.issues
              .slice(0, 12)
              .map((issue) => {
                const limit =
                  "maximum" in issue
                    ? `(max ${issue.maximum})`
                    : "minimum" in issue
                      ? `(min ${issue.minimum})`
                      : "";
                return `${issue.path.join(".") || "<root>"}:${issue.code}${limit}`;
              })
              .join(", "),
            // Shape-only diagnostics for a `custom` refine, which reports no
            // bound of its own: a word/character count says whether the model
            // overshot or undershot the budget, which is the difference between
            // "raise the cap" and "fix the prompt". Counts only, never content —
            // these strings are the user's reflection.
            sizes: parsed.error.issues
              .slice(0, 12)
              .map((issue) => {
                const value = issue.path.reduce<unknown>(
                  (node, key) =>
                    node && typeof node === "object"
                      ? (node as Record<string, unknown>)[String(key)]
                      : undefined,
                  parsedJson,
                );
                if (typeof value !== "string") return null;
                const words = value.trim().split(/\s+/).filter(Boolean).length;
                return `${issue.path.join(".") || "<root>"}:${words}w/${value.length}c`;
              })
              .filter(Boolean)
              .join(", "),
          },
        }),
      );
      return { data: null, failure: "schema_validation_failed" };
    }

    emitOpenAiCallAudit({
      kind: "structured",
      feature,
      schemaName,
      model: responseMetadata.model,
      outcome: "success",
      failure: null,
      responseId: responseMetadata.responseId,
    });
    return { data: parsed.data, failure: null };
  } catch (error) {
    emitOpenAiCallAudit({
      kind: "structured",
      feature,
      schemaName,
      model: resolvedModel,
      outcome: "failure",
      failure: "exception",
      responseId: null,
    });
    console.error(
      buildSafeErrorLog({
        event: "openai.responses.exception",
        fieldPath: feature,
        code: getSafeErrorCode(error),
      }),
    );
    return { data: null, failure: "exception" };
  }
};

const requestStructuredOpenAi = async <T>(
  request: StructuredOpenAiRequest<T>,
): Promise<T | null> => (await requestStructuredOpenAiDetailed(request)).data;

type OpenAiEmbeddingResponse = {
  data?: { embedding?: number[]; index?: number }[];
};

/** One transient array-input request; output is restored to input order. */
const requestEmbeddings = async (
  texts: string[],
  { model }: { model?: string } = {},
): Promise<number[][] | null> => {
  const resolvedModel = model?.trim() || getOpenAiEmbeddingModel();

  if (!isOpenAiConfigured()) {
    emitOpenAiCallAudit({
      kind: "embedding",
      feature: "embedding",
      schemaName: null,
      model: resolvedModel,
      outcome: "failure",
      failure: "not_configured",
      responseId: null,
    });
    return null;
  }

  const inputs = texts.map((text) => text.trim());
  if (!inputs.length || inputs.some((input) => !input)) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getOpenAiApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: resolvedModel, input: inputs }),
    });

    if (!response.ok) {
      emitOpenAiCallAudit({
        kind: "embedding",
        feature: "embedding",
        schemaName: null,
        model: resolvedModel,
        outcome: "failure",
        failure: "http_error",
        responseId: null,
      });
      console.error(
        buildSafeErrorLog({
          event: "openai.embeddings.request_failed",
          fieldPath: "embedding",
          status: response.status,
          code: `http_${response.status}`,
        }),
      );
      return null;
    }

    const payload = (await response.json()) as OpenAiEmbeddingResponse;
    const ordered = [...(payload.data || [])].sort(
      (left, right) => (left.index ?? 0) - (right.index ?? 0),
    );
    const embeddings = ordered.map((item) => item.embedding);

    if (
      embeddings.length !== inputs.length ||
      embeddings.some(
        (embedding) => !Array.isArray(embedding) || embedding.length === 0,
      )
    ) {
      emitOpenAiCallAudit({
        kind: "embedding",
        feature: "embedding",
        schemaName: null,
        model: resolvedModel,
        outcome: "failure",
        failure: "invalid_vectors",
        responseId: null,
      });
      console.error(
        buildSafeErrorLog({
          event: "openai.embeddings.incomplete_vectors",
          fieldPath: "embedding",
          code: "incomplete_vectors",
        }),
      );
      return null;
    }

    emitOpenAiCallAudit({
      kind: "embedding",
      feature: "embedding",
      schemaName: null,
      model: resolvedModel,
      outcome: "success",
      failure: null,
      responseId: null,
    });
    return embeddings as number[][];
  } catch (error) {
    emitOpenAiCallAudit({
      kind: "embedding",
      feature: "embedding",
      schemaName: null,
      model: resolvedModel,
      outcome: "failure",
      failure: "exception",
      responseId: null,
    });
    console.error(
      buildSafeErrorLog({
        event: "openai.embeddings.exception",
        fieldPath: "embedding",
        code: getSafeErrorCode(error),
      }),
    );
    return null;
  }
};

/**
 * Fetch an embedding vector for the given text via the OpenAI embeddings API.
 * Mirrors the never-throw / null-on-failure contract of requestStructuredOpenAi:
 * callers must treat null as "no embedding" and keep working (semantic recall is
 * a best-effort enhancement, never a hard dependency). Never pass raw journal
 * text you would not want stored — callers embed distilled memory text only.
 */
const requestEmbedding = async (
  text: string,
  { model }: { model?: string } = {},
): Promise<number[] | null> => {
  const input = text.trim();
  if (!input) {
    return null;
  }

  const embeddings = await requestEmbeddings([input], model ? { model } : {});
  return embeddings?.[0] || null;
};

export {
  canUseOpenAiForUser,
  getOpenAiEmbeddingModel,
  getOpenAiModel,
  getUserAiAccessState,
  isOpenAiConfigured,
  requestEmbedding,
  requestEmbeddings,
  registerOpenAiCallAuditObserver,
  requestStructuredOpenAi,
  requestStructuredOpenAiDetailed,
};
export type { OpenAiCallAuditObserver };
