import { z } from "zod";
import { userModel } from "../schema/user.schema";
import { hasActivePremiumEntitlement } from "./premiumEntitlement.helpers";
import {
  buildSafeErrorLog,
  getSafeErrorCode,
} from "./safeLogging.helpers";

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
  | { data: T; failure: null }
  | { data: null; failure: StructuredOpenAiFailure };

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

const getUserAiAccessState = async (userId: string): Promise<UserAiAccessState> => {
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
  // Dev/testing bypass (never set in production): AI_ALLOW_NON_PREMIUM=true lets
  // opted-in non-premium users reach the model so the AI surfaces can be tested.
  const isPremium =
    accessState.isPremium || process.env.AI_ALLOW_NON_PREMIUM === "true";
  return isPremium;
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
  if (!isOpenAiConfigured()) {
    return { data: null, failure: "not_configured" };
  }

  try {
    const resolvedModel = model?.trim() || getOpenAiModel();
    const response = await fetch("https://api.openai.com/v1/responses", {
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
        ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            strict: true,
            schema,
          },
        },
      }),
    });

    if (!response.ok) {
      console.error(
        buildSafeErrorLog({
          event: "openai.responses.request_failed",
          fieldPath: feature,
          status: response.status,
          code: `http_${response.status}`,
        })
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
      console.error(
        buildSafeErrorLog({
          event: "openai.responses.incomplete",
          fieldPath: feature,
          code: payload.incomplete_details?.reason || "incomplete",
          metadata: responseMetadata,
        })
      );
      return { data: null, failure: "incomplete" };
    }

    if (!outputText) {
      console.error(
        buildSafeErrorLog({
          event: "openai.responses.empty_output",
          fieldPath: feature,
          code: "empty_output",
        })
      );
      return { data: null, failure: "empty_output" };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(outputText);
    } catch {
      console.error(
        buildSafeErrorLog({
          event: "openai.responses.invalid_json",
          fieldPath: feature,
          code: "invalid_json",
          metadata: responseMetadata,
        })
      );
      return { data: null, failure: "invalid_json" };
    }
    const parsed = parser.safeParse(parsedJson);

    if (!parsed.success) {
      console.error(
        buildSafeErrorLog({
          event: "openai.responses.schema_validation_failed",
          fieldPath: feature,
          code: "schema_validation_failed",
        })
      );
      return { data: null, failure: "schema_validation_failed" };
    }

    return { data: parsed.data, failure: null };
  } catch (error) {
    console.error(
      buildSafeErrorLog({
        event: "openai.responses.exception",
        fieldPath: feature,
        code: getSafeErrorCode(error),
      })
    );
    return { data: null, failure: "exception" };
  }
};

const requestStructuredOpenAi = async <T>(
  request: StructuredOpenAiRequest<T>
): Promise<T | null> => (await requestStructuredOpenAiDetailed(request)).data;

type OpenAiEmbeddingResponse = {
  data?: { embedding?: number[]; index?: number }[];
};

/** One transient array-input request; output is restored to input order. */
const requestEmbeddings = async (
  texts: string[],
  { model }: { model?: string } = {}
): Promise<number[][] | null> => {
  if (!isOpenAiConfigured()) {
    return null;
  }

  const inputs = texts.map((text) => text.trim());
  if (!inputs.length || inputs.some((input) => !input)) {
    return null;
  }

  try {
    const resolvedModel = model?.trim() || getOpenAiEmbeddingModel();
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getOpenAiApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: resolvedModel, input: inputs }),
    });

    if (!response.ok) {
      console.error(
        buildSafeErrorLog({
          event: "openai.embeddings.request_failed",
          fieldPath: "embedding",
          status: response.status,
          code: `http_${response.status}`,
        })
      );
      return null;
    }

    const payload = (await response.json()) as OpenAiEmbeddingResponse;
    const ordered = [...(payload.data || [])].sort(
      (left, right) => (left.index ?? 0) - (right.index ?? 0)
    );
    const embeddings = ordered.map((item) => item.embedding);

    if (
      embeddings.length !== inputs.length ||
      embeddings.some(
        (embedding) => !Array.isArray(embedding) || embedding.length === 0
      )
    ) {
      console.error(
        buildSafeErrorLog({
          event: "openai.embeddings.incomplete_vectors",
          fieldPath: "embedding",
          code: "incomplete_vectors",
        })
      );
      return null;
    }

    return embeddings as number[][];
  } catch (error) {
    console.error(
      buildSafeErrorLog({
        event: "openai.embeddings.exception",
        fieldPath: "embedding",
        code: getSafeErrorCode(error),
      })
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
  { model }: { model?: string } = {}
): Promise<number[] | null> => {
  const input = text.trim();
  if (!input) {
    return null;
  }

  const embeddings = await requestEmbeddings(
    [input],
    model ? { model } : {}
  );
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
  requestStructuredOpenAi,
  requestStructuredOpenAiDetailed,
};
