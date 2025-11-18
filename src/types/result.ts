/**
 * Result Type & Error Handling
 * 
 * All game operations return Result<T, ValidationError> to enable:
 * - Non-throwing error handling
 * - Detailed validation errors with suggested fixes
 * - Guiding players to valid game states
 */

/**
 * Result type - represents success or failure
 */
export type Result<T, E = ValidationError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Creates a successful result
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Creates a failed result
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Type guard for successful results
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

/**
 * Type guard for failed results
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

/**
 * Unwraps a result, throwing if it's an error
 * Use only in tests or when you're certain of success
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw new Error(`Unwrap failed: ${JSON.stringify(result.error)}`);
}

/**
 * Maps a successful result to a new value
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Chains result-returning operations
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

/**
 * Suggested fix for reaching a valid game state
 */
export interface SuggestedFix {
  /** Description of the fix */
  description: string;
  /** Optional specific action to take */
  action?: {
    type: string;
    params?: Record<string, unknown>;
  };
}

/**
 * Validation error with path and suggested fixes
 */
export interface ValidationError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Path to the problematic part of game state (e.g., ['players', 'p1', 'hand']) */
  path?: string[];
  /** Suggested ways to fix the error */
  fixes?: SuggestedFix[];
}

/**
 * Creates a validation error
 */
export function validationError(
  code: string,
  message: string,
  path?: string[],
  fixes?: SuggestedFix[]
): ValidationError {
  return { code, message, path, fixes };
}
