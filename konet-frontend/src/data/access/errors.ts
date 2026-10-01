export class DataError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "REQUEST_FAILED") { super(message); }
}
export function required<T>(value: T | null | undefined, message = "This item could not be found."): T {
  if (value == null) throw new DataError(message, 404, "NOT_FOUND");
  return value;
}
