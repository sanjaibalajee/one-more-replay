export type Action = <T = unknown>(
  payload: Record<string, unknown>,
) => Promise<T | null>;
