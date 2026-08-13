import { getFieldEncryptionMode } from "./fieldEncryption.helpers";

const PRIVACY_TERMS = /\b(encrypt(?:ed|ion)?|private|privacy|secure|safe|protected|confidential)\b/i;
const DATA_TERMS = /\b(message|messages|chat|chats|journal|journals|entry|entries|data|writing|conversation|conversations|stored|storage|read|access|see|server|jade|app)\b/i;
const DIRECT_ACCESS_QUESTIONS =
  /\b(who (?:can|could) (?:see|read|access)|can (?:anyone|someone|staff|you) (?:see|read|access))\b/i;

export const isProductPrivacyQuestion = (value: string): boolean => {
  const text = value.trim();
  return DIRECT_ACCESS_QUESTIONS.test(text) ||
    (PRIVACY_TERMS.test(text) && DATA_TERMS.test(text));
};

export const buildProductPrivacyReply = (): string => {
  const mode = getFieldEncryptionMode();
  const shared =
    "Journal.IO protects data in transit with HTTPS/TLS and keeps your content scoped to your authenticated account.";

  const atRest =
    mode === "enforced"
      ? "Ask Jade messages also use application-level encryption at rest in this environment."
      : mode === "migration"
        ? "New Ask Jade messages are written with application-level encryption at rest while older data may still be moving through the encryption rollout."
        : "Additional application-level field encryption at rest is not enabled in this environment.";

  return `${shared} ${atRest} It is not end-to-end encrypted, because the server must process your writing to provide Jade's features.`;
};
