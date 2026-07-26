/**
 * Safe extraction of Plaid/axios error detail for logging.
 *
 * The Plaid SDK is built on axios, and an axios error carries the full request
 * config — including `config.data`, which for most Plaid calls contains the
 * item's `access_token`. Passing such an error straight to console.error writes
 * live bank credentials into the platform log, where they persist and are
 * readable by anyone with log access.
 *
 * Everything here is allow-listed: only known-safe fields are copied out, so a
 * future SDK change cannot silently widen what gets logged.
 */

export type PlaidErrorInfo = {
  code: string;
  type?: string;
  message?: string;
  /** Plaid's request id — the thing their support asks for. Safe to log. */
  requestId?: string;
  status?: number;
};

export function describePlaidError(error: unknown): PlaidErrorInfo {
  const err = error as {
    response?: {
      status?: number;
      data?: {
        error_code?: string;
        error_type?: string;
        error_message?: string;
        request_id?: string;
      };
    };
    message?: string;
  };

  const data = err?.response?.data;

  if (data?.error_code) {
    return {
      code: data.error_code,
      type: data.error_type,
      // Plaid's display messages describe the condition, not the credentials.
      message: data.error_message,
      requestId: data.request_id,
      status: err.response?.status,
    };
  }

  // Not a Plaid API error (network failure, bug in our own code). Take only the
  // message — never the object, which may carry the request config.
  return { code: "UNKNOWN_ERROR", message: err?.message ?? "Unknown error" };
}

/** Convenience for the common `console.error("[plaid] ...", ...)` call. */
export function plaidErrorCode(error: unknown): string {
  return describePlaidError(error).code;
}
