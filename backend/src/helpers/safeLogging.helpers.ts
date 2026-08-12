type SafeErrorLogInput = {
  event: string;
  fieldPath?: string | null;
  documentId?: string | null;
  status?: number | null;
  code?: string | null;
};

type UnsafeErrorShape = {
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
};

export const getSafeErrorCode = (error: unknown): string => {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as UnsafeErrorShape).code === "string"
  ) {
    return (error as UnsafeErrorShape).code as string;
  }

  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    typeof (error as { name?: unknown }).name === "string"
  ) {
    return (error as { name: string }).name;
  }

  return "unknown_error";
};

export const getSafeErrorStatus = (error: unknown): number | null => {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as UnsafeErrorShape).status === "number"
  ) {
    return (error as UnsafeErrorShape).status as number;
  }

  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof (error as UnsafeErrorShape).statusCode === "number"
  ) {
    return (error as UnsafeErrorShape).statusCode as number;
  }

  return null;
};

export const buildSafeErrorLog = ({
  event,
  fieldPath = null,
  documentId = null,
  status = null,
  code = null,
}: SafeErrorLogInput) => ({
  event,
  fieldPath,
  documentId,
  status,
  code,
});
