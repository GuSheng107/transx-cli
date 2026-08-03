export type ErrorCode =
  | "INVALID_ARGUMENT"
  | "CONFIG_NOT_INITIALIZED"
  | "CONFIG_INVALID"
  | "NETWORK_ERROR"
  | "API_HTTP_ERROR"
  | "API_RESPONSE_INVALID"
  | "INSTALL_ERROR"
  | "UPDATE_ERROR"
  | "CANCELLED";

export class TransxError extends Error {
  readonly code: ErrorCode;
  readonly exitCode: number;

  constructor(code: ErrorCode, message: string, exitCode: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "TransxError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

export function toTransxError(error: unknown): TransxError {
  if (error instanceof TransxError) {
    return error;
  }
  if (error instanceof Error) {
    return new TransxError("NETWORK_ERROR", error.message, 4, { cause: error });
  }
  return new TransxError("NETWORK_ERROR", "发生未知错误", 4);
}
