import type { EvErrorCode, EvIssueKind } from "./types";

export class EvProfileError extends Error {
  readonly code: EvErrorCode;
  readonly kind: EvIssueKind;
  readonly details?: Record<string, unknown>;

  constructor(
    code: EvErrorCode,
    kind: EvIssueKind,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "EvProfileError";
    this.code = code;
    this.kind = kind;
    this.details = details;
  }
}

export function invalidInput(
  code: EvErrorCode,
  message: string,
  details?: Record<string, unknown>
): EvProfileError {
  return new EvProfileError(code, "invalid_input", message, details);
}

export function infeasible(
  code: EvErrorCode,
  message: string,
  details?: Record<string, unknown>
): EvProfileError {
  return new EvProfileError(code, "infeasible", message, details);
}
