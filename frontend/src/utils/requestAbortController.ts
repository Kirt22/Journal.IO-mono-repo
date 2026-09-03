type RequestAbortController = {
  abort: () => void;
  signal: NonNullable<RequestInit['signal']>;
};

/**
 * React Native and TypeScript expose structurally different AbortSignal types,
 * although both refer to the same runtime controller. Keep that type bridge at
 * the fetch boundary instead of spreading casts through request code.
 */
export const createRequestAbortController = (): RequestAbortController => {
  const controller = new AbortController();

  return {
    abort: () => controller.abort(),
    signal: controller.signal as RequestAbortController['signal'],
  };
};
