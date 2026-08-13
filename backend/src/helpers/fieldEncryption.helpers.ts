import crypto from "crypto";

export type FieldEncryptionMode = "disabled" | "migration" | "enforced";

type EncryptionKeyRecord = {
  id: string;
  key: Buffer;
};

type FieldEncryptionConfig = {
  mode: FieldEncryptionMode;
  activeKeyId: string | null;
  activeKey: Buffer | null;
  keys: Map<string, Buffer>;
  lookupHmacKey: Buffer | null;
  canaryCiphertext: string | null;
  canaryLookupDigest: string | null;
};

type EncryptFieldValueOptions = {
  path: string;
};

type LookupHashOptions = {
  value: string | null | undefined;
  path: string;
  scope?: string | null;
};

const ENVELOPE_VERSION = "v1";
const ENVELOPE_PREFIX = `jioenc:${ENVELOPE_VERSION}`;
const ENCRYPTION_CANARY_VALUE = "journalio-field-encryption-canary";
const LOOKUP_CANARY_PATH = "__field_lookup_canary__";
const IV_BYTES = 12;

export class FieldEncryptionError extends Error {
  code: string;

  constructor(message: string, code = "FIELD_ENCRYPTION_ERROR") {
    super(message);
    this.name = "FieldEncryptionError";
    this.code = code;
  }
}

export class FieldEncryptionPlaintextReadError extends FieldEncryptionError {
  constructor(path: string) {
    super(
      `Plaintext is not allowed for encrypted field "${path}" in enforced mode.`,
      "FIELD_ENCRYPTION_PLAINTEXT_READ"
    );
    this.name = "FieldEncryptionPlaintextReadError";
  }
}

export class FieldEncryptionConfigError extends FieldEncryptionError {
  constructor(message: string) {
    super(message, "FIELD_ENCRYPTION_CONFIG");
    this.name = "FieldEncryptionConfigError";
  }
}

const normalizeMode = (value?: string | null): FieldEncryptionMode => {
  const normalized = value?.trim().toLowerCase();

  if (!normalized || normalized === "disabled") {
    return "disabled";
  }

  if (normalized === "migration" || normalized === "enforced") {
    return normalized;
  }

  throw new FieldEncryptionConfigError(
    "FIELD_ENCRYPTION_MODE must be disabled, migration, or enforced."
  );
};

const parseSecretBuffer = (value: string, label: string): Buffer => {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new FieldEncryptionConfigError(`${label} is empty.`);
  }

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  try {
    const decoded = Buffer.from(trimmed, "base64");

    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // Fall through to the shared error below.
  }

  throw new FieldEncryptionConfigError(
    `${label} must be a 32-byte base64 or 64-char hex secret.`
  );
};

const parseEncryptionKeys = (
  rawValue?: string | null
): EncryptionKeyRecord[] => {
  if (!rawValue?.trim()) {
    return [];
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    throw new FieldEncryptionConfigError("FIELD_ENCRYPTION_KEYS_JSON is invalid JSON.");
  }

  const records: EncryptionKeyRecord[] = [];

  if (Array.isArray(parsedValue)) {
    for (const item of parsedValue) {
      if (
        !item ||
        typeof item !== "object" ||
        typeof (item as { id?: unknown }).id !== "string" ||
        typeof (item as { key?: unknown }).key !== "string"
      ) {
        throw new FieldEncryptionConfigError(
          "FIELD_ENCRYPTION_KEYS_JSON array items must include string id and key fields."
        );
      }

      records.push({
        id: (item as { id: string }).id.trim(),
        key: parseSecretBuffer((item as { key: string }).key, "FIELD_ENCRYPTION_KEYS_JSON key"),
      });
    }

    return records;
  }

  if (!parsedValue || typeof parsedValue !== "object") {
    throw new FieldEncryptionConfigError(
      "FIELD_ENCRYPTION_KEYS_JSON must be an object or an array."
    );
  }

  for (const [id, key] of Object.entries(
    parsedValue as Record<string, unknown>
  )) {
    if (typeof key !== "string") {
      throw new FieldEncryptionConfigError(
        "FIELD_ENCRYPTION_KEYS_JSON object values must be strings."
      );
    }

    records.push({
      id: id.trim(),
      key: parseSecretBuffer(key, `FIELD_ENCRYPTION_KEYS_JSON.${id}`),
    });
  }

  return records;
};

const getFieldEncryptionConfig = (
  env: NodeJS.ProcessEnv = process.env
): FieldEncryptionConfig => {
  const mode = normalizeMode(env.FIELD_ENCRYPTION_MODE);
  const keyRecords = parseEncryptionKeys(env.FIELD_ENCRYPTION_KEYS_JSON);
  const keys = new Map<string, Buffer>();

  for (const record of keyRecords) {
    if (!record.id) {
      throw new FieldEncryptionConfigError(
        "FIELD_ENCRYPTION_KEYS_JSON includes an empty key id."
      );
    }
    keys.set(record.id, record.key);
  }

  const activeKeyId = env.FIELD_ENCRYPTION_ACTIVE_KEY_ID?.trim() || null;
  const activeKey = activeKeyId ? keys.get(activeKeyId) || null : null;
  const lookupHmacKey = env.FIELD_LOOKUP_HMAC_KEY?.trim()
    ? parseSecretBuffer(env.FIELD_LOOKUP_HMAC_KEY, "FIELD_LOOKUP_HMAC_KEY")
    : null;

  return {
    mode,
    activeKeyId,
    activeKey,
    keys,
    lookupHmacKey,
    canaryCiphertext: env.FIELD_ENCRYPTION_CANARY?.trim() || null,
    canaryLookupDigest: env.FIELD_LOOKUP_HMAC_CANARY?.trim() || null,
  };
};

const isFieldEncryptionEnabled = (
  env: NodeJS.ProcessEnv = process.env
): boolean => getFieldEncryptionConfig(env).mode !== "disabled";

const isEncryptedEnvelope = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith(`${ENVELOPE_PREFIX}:`);

const encodeEnvelope = ({
  keyId,
  iv,
  tag,
  ciphertext,
}: {
  keyId: string;
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
}) =>
  [
    ENVELOPE_PREFIX,
    keyId,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");

const decodeEnvelope = (value: string) => {
  const parts = value.split(":");

  if (parts.length !== 6 || parts[0] !== "jioenc" || parts[1] !== ENVELOPE_VERSION) {
    throw new FieldEncryptionError("Encrypted field has an invalid envelope.", "FIELD_ENCRYPTION_ENVELOPE");
  }

  const keyId = parts[2];
  const iv = Buffer.from(parts[3] || "", "base64url");
  const tag = Buffer.from(parts[4] || "", "base64url");
  const ciphertext = Buffer.from(parts[5] || "", "base64url");

  if (!keyId || iv.length !== IV_BYTES || tag.length !== 16 || ciphertext.length === 0) {
    throw new FieldEncryptionError("Encrypted field has malformed envelope data.", "FIELD_ENCRYPTION_ENVELOPE");
  }

  return { keyId, iv, tag, ciphertext };
};

const serializePlaintext = (value: unknown): string => JSON.stringify(value);

const deserializePlaintext = (value: string): unknown => JSON.parse(value);

export const decryptFieldValue = <T = unknown>(
  rawValue: unknown,
  { path }: EncryptFieldValueOptions,
  env: NodeJS.ProcessEnv = process.env
): T => {
  if (rawValue === null || rawValue === undefined) {
    return rawValue as T;
  }

  const config = getFieldEncryptionConfig(env);

  if (!isEncryptedEnvelope(rawValue)) {
    if (config.mode === "enforced") {
      throw new FieldEncryptionPlaintextReadError(path);
    }

    return rawValue as T;
  }

  const { keyId, iv, tag, ciphertext } = decodeEnvelope(rawValue);
  const key = config.keys.get(keyId);

  if (!key) {
    throw new FieldEncryptionError(
      `No encryption key is configured for key id "${keyId}".`,
      "FIELD_ENCRYPTION_KEY_NOT_FOUND"
    );
  }

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(path, "utf8"));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");

    return deserializePlaintext(plaintext) as T;
  } catch (error) {
    throw new FieldEncryptionError(
      `Unable to decrypt encrypted field "${path}".`,
      "FIELD_ENCRYPTION_DECRYPT_FAILED"
    );
  }
};

export const encryptFieldValue = (
  rawValue: unknown,
  { path }: EncryptFieldValueOptions,
  env: NodeJS.ProcessEnv = process.env
): unknown => {
  if (rawValue === null || rawValue === undefined) {
    return rawValue;
  }

  if (isEncryptedEnvelope(rawValue)) {
    return rawValue;
  }

  const config = getFieldEncryptionConfig(env);

  if (config.mode === "disabled") {
    return rawValue;
  }

  if (!config.activeKeyId || !config.activeKey) {
    throw new FieldEncryptionConfigError(
      "FIELD_ENCRYPTION_ACTIVE_KEY_ID must reference a configured key when encryption is enabled."
    );
  }

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", config.activeKey, iv);
  cipher.setAAD(Buffer.from(path, "utf8"));
  const plaintext = Buffer.from(serializePlaintext(rawValue), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return encodeEnvelope({
    keyId: config.activeKeyId,
    iv,
    tag,
    ciphertext,
  });
};

export const computeLookupHash = (
  { value, path, scope }: LookupHashOptions,
  env: NodeJS.ProcessEnv = process.env
): string | null => {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return null;
  }

  const { lookupHmacKey, mode } = getFieldEncryptionConfig(env);

  if (!lookupHmacKey) {
    if (mode === "disabled") {
      return null;
    }

    throw new FieldEncryptionConfigError(
      "FIELD_LOOKUP_HMAC_KEY must be configured when field encryption is enabled."
    );
  }

  const digest = crypto.createHmac("sha256", lookupHmacKey);
  digest.update(path);
  digest.update(":");
  if (scope) {
    digest.update(scope);
  }
  digest.update(":");
  digest.update(normalizedValue);
  return digest.digest("hex");
};

export const buildFieldEncryptionCanaries = (
  env: NodeJS.ProcessEnv = process.env
) => {
  const ciphertext = encryptFieldValue(
    ENCRYPTION_CANARY_VALUE,
    { path: "__field_encryption_canary__" },
    {
      ...env,
      FIELD_ENCRYPTION_MODE: "migration",
    }
  );
  const lookupDigest = computeLookupHash(
    {
      value: ENCRYPTION_CANARY_VALUE,
      path: LOOKUP_CANARY_PATH,
    },
    {
      ...env,
      FIELD_ENCRYPTION_MODE: "migration",
    }
  );

  return {
    ciphertext: typeof ciphertext === "string" ? ciphertext : null,
    lookupDigest,
  };
};

export const assertFieldEncryptionReady = (
  env: NodeJS.ProcessEnv = process.env
) => {
  const config = getFieldEncryptionConfig(env);

  if (config.mode === "disabled") {
    return;
  }

  if (!config.activeKeyId || !config.activeKey) {
    throw new FieldEncryptionConfigError(
      "Field encryption is enabled, but FIELD_ENCRYPTION_ACTIVE_KEY_ID is missing or invalid."
    );
  }

  if (!config.lookupHmacKey) {
    throw new FieldEncryptionConfigError(
      "Field encryption is enabled, but FIELD_LOOKUP_HMAC_KEY is missing."
    );
  }

  if (!config.canaryCiphertext || !config.canaryLookupDigest) {
    throw new FieldEncryptionConfigError(
      "Field encryption is enabled, but FIELD_ENCRYPTION_CANARY or FIELD_LOOKUP_HMAC_CANARY is missing."
    );
  }

  const decryptedCanary = decryptFieldValue<string>(
    config.canaryCiphertext,
    { path: "__field_encryption_canary__" },
    env
  );

  if (decryptedCanary !== ENCRYPTION_CANARY_VALUE) {
    throw new FieldEncryptionConfigError(
      "Field encryption canary decryption failed."
    );
  }

  const lookupDigest = computeLookupHash(
    {
      value: ENCRYPTION_CANARY_VALUE,
      path: LOOKUP_CANARY_PATH,
    },
    env
  );

  if (!lookupDigest || lookupDigest !== config.canaryLookupDigest) {
    throw new FieldEncryptionConfigError(
      "Field lookup HMAC canary validation failed."
    );
  }
};

export const normalizeEncryptedString = (
  value?: string | null
): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const getFieldEncryptionMode = (
  env: NodeJS.ProcessEnv = process.env
): FieldEncryptionMode => getFieldEncryptionConfig(env).mode;

export { ENVELOPE_PREFIX, getFieldEncryptionConfig, isEncryptedEnvelope, isFieldEncryptionEnabled };
