export class AppError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "AUTH_ERROR"
      | "SHEETS_ACCESS_ERROR"
      | "GMAIL_API_ERROR"
      | "RATE_LIMIT_ERROR"
      | "PARSING_ERROR"
      | "VALIDATION_ERROR"
      | "UNKNOWN_ERROR",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toAppError(error: unknown, fallbackMessage: string): AppError {
  if (error instanceof AppError) {
    return error;
  }
  return new AppError(fallbackMessage, "UNKNOWN_ERROR", error);
}
