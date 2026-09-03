import mongoose from "mongoose";
import {
  decryptFieldValue,
  encryptFieldValue,
} from "./fieldEncryption.helpers";

type EncryptedPathDefinition = {
  path: string;
};

type LeanDecryptPathDefinition = {
  encryptedPath: string;
  plaintextPath?: string;
};

export const applyEncryptedSchemaPaths = (
  schema: mongoose.Schema,
  paths: EncryptedPathDefinition[]
) => {
  const toJsonOptions = {
    ...((schema.get("toJSON") as Record<string, unknown> | undefined) || {}),
    getters: true,
  };
  const toObjectOptions = {
    ...((schema.get("toObject") as Record<string, unknown> | undefined) || {}),
    getters: true,
  };

  schema.set("toJSON", toJsonOptions as never);
  schema.set("toObject", toObjectOptions as never);

  for (const { path } of paths) {
    const schemaPath = schema.path(path);

    if (!schemaPath) {
      continue;
    }

    schemaPath.set((value: unknown) => encryptFieldValue(value, { path }));
    schemaPath.get((value: unknown) => decryptFieldValue(value, { path }));
  }
};

export const setEncryptedDocumentValue = (
  document: mongoose.Document,
  path: string,
  value: unknown
) => {
  if (typeof (document as { set?: unknown }).set === "function") {
    document.set(path, value);
  } else {
    const segments = path.split(".");
    const lastSegment = segments.pop();

    if (!lastSegment) {
      return;
    }

    let cursor = document as unknown as Record<string, unknown>;

    for (const segment of segments) {
      const existing = cursor[segment];

      if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
        cursor[segment] = {};
      }

      cursor = cursor[segment] as Record<string, unknown>;
    }

    cursor[lastSegment] = value;
  }

  if (typeof (document as { markModified?: unknown }).markModified === "function") {
    document.markModified(path);
  }
};

/**
 * Decrypt encrypted fields on a `.lean()` row, which bypasses the schema
 * getters installed by `applyEncryptedSchemaPaths`.
 *
 * `encryptedPath` must be the same path string the value was encrypted under,
 * because that path is sealed into the ciphertext as AES-GCM additional
 * authenticated data. For a field declared on a subdocument schema, that is the
 * path *relative to that subschema* — so call this on the subdocument itself
 * (`decryptLeanFields(row.structured, [{ encryptedPath: "keyRelationships" }])`)
 * rather than reaching through the parent with a dotted path, which fails the
 * auth-tag check and throws `FIELD_ENCRYPTION_DECRYPT_FAILED`.
 */
export const decryptLeanFields = <T>(
  row: T,
  paths: LeanDecryptPathDefinition[]
): T => {
  const decryptedRow = { ...(row as Record<string, unknown>) };

  const readPath = (source: Record<string, unknown>, path: string): unknown =>
    path.split(".").reduce<unknown>((current, segment) => {
      if (!current || typeof current !== "object") {
        return undefined;
      }

      return (current as Record<string, unknown>)[segment];
    }, source);

  const writePath = (
    target: Record<string, unknown>,
    path: string,
    value: unknown
  ) => {
    const segments = path.split(".");
    const lastSegment = segments.pop();

    if (!lastSegment) {
      return;
    }

    let cursor: Record<string, unknown> = target;

    for (const segment of segments) {
      const existing = cursor[segment];

      if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
        cursor[segment] = {};
      }

      cursor = cursor[segment] as Record<string, unknown>;
    }

    cursor[lastSegment] = value;
  };

  for (const { encryptedPath, plaintextPath } of paths) {
    const nextPath = plaintextPath || encryptedPath;
    const rawValue = readPath(decryptedRow, encryptedPath);
    writePath(decryptedRow, nextPath, decryptFieldValue(rawValue, {
      path: encryptedPath,
    }));
  }

  return decryptedRow as T;
};
