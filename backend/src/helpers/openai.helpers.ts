import { z } from "zod";
import { userModel } from "../schema/user.schema";

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
};

type OpenAiResponseContent = {
  text?: string;
  type?: string;
};

type OpenAiResponseOutput = {
  content?: OpenAiResponseContent[];
};

type OpenAiApiResponse = {
  output_text?: string;
  output?: OpenAiResponseOutput[];
};

const getOpenAiApiKey = () => process.env.OPENAI_API_KEY?.trim() || "";
const getOpenAiModel = () =>
  process.env.OPENAI_RESPONSES_MODEL?.trim() ||
  process.env.OPENAI_MODEL?.trim() ||
  "gpt-5.4-mini";
const shouldLogOpenAiDebug =
  process.env.OPENAI_DEBUG_LOGS === "true" || process.env.NODE_ENV !== "production";

const isOpenAiConfigured = () => Boolean(getOpenAiApiKey());

type UserAiAccessState = {
  isPremium: boolean;
  aiOptIn: boolean | null;
};

const getUserAiAccessState = async (userId: string): Promise<UserAiAccessState> => {
  const user = await userModel
    .findById(userId)
    .select("isPremium onboardingContext.aiOptIn")
    .lean()
    .exec();

  return {
    isPremium: Boolean(user?.isPremium),
    aiOptIn:
      typeof user?.onboardingContext?.aiOptIn === "boolean"
        ? user.onboardingContext.aiOptIn
        : null,
  };
};

const canUseOpenAiForUser = async (userId: string) => {
  if (!isOpenAiConfigured()) {
    return false;
  }

  const accessState = await getUserAiAccessState(userId);
  return accessState.isPremium && accessState.aiOptIn !== false;
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

const requestStructuredOpenAi = async <T>({
  feature,
  schemaName,
  schema,
  parser,
  messages,
  maxOutputTokens = 900,
}: StructuredOpenAiRequest<T>): Promise<T | null> => {
  if (!isOpenAiConfigured()) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getOpenAiApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getOpenAiModel(),
        input: messages,
        max_output_tokens: maxOutputTokens,
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
      const errorText = await response.text();
      console.error(
        `OpenAI ${feature} request failed with status ${response.status}:`,
        errorText.slice(0, 400)
      );
      return null;
    }

    const payload = (await response.json()) as OpenAiApiResponse;
    const outputText = readOpenAiOutputText(payload);

    if (shouldLogOpenAiDebug) {
      console.log(`[OpenAI] ${feature} raw response`, {
        model: getOpenAiModel(),
        schemaName,
        outputText,
        payload,
      });
    }

    if (!outputText) {
      console.error(`OpenAI ${feature} request returned empty structured output.`);
      return null;
    }

    const parsedJson = JSON.parse(outputText);
    const parsed = parser.safeParse(parsedJson);

    if (!parsed.success) {
      console.error(
        `OpenAI ${feature} response failed schema validation:`,
        parsed.error.flatten()
      );
      return null;
    }

    if (shouldLogOpenAiDebug) {
      console.log(`[OpenAI] ${feature} parsed response`, {
        model: getOpenAiModel(),
        schemaName,
        parsed: parsed.data,
      });
    }

    return parsed.data;
  } catch (error) {
    console.error(`OpenAI ${feature} request failed:`, error);
    return null;
  }
};

export {
  canUseOpenAiForUser,
  getOpenAiModel,
  getUserAiAccessState,
  isOpenAiConfigured,
  requestStructuredOpenAi,
};
