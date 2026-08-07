/**
 * AppException — raw, low-level, technical errors thrown from the data layer
 * (HttpClient, IndexedDB engine, JSON parsing). Mirrors the React/Flutter
 * guide's sealed `AppException`.
 *
 * These are *not* shown to users. The guards convert them into user-facing
 * Failures (see failure.ts). They live strictly inside the data layer.
 *
 * `cause` carries the original error so the full chain can be reconstructed.
 * It is assigned in the constructor body (not via super options) because, with
 * `useDefineForClassFields`, redeclaring `cause` as a field would otherwise
 * reset it to undefined after `super()` runs.
 *
 * Pure TS (no Angular) so it can be unit-tested in isolation.
 */
export type AppExceptionCause = unknown;

export interface AppExceptionOptions {
  cause?: AppExceptionCause;
}

export abstract class AppException extends Error {
  override readonly cause?: AppExceptionCause;

  constructor(message: string, options: AppExceptionOptions = {}) {
    super(message);
    this.name = this.constructor.name;
    // Assigned after the field initializer stage so it survives construction.
    this.cause = options.cause;
  }
}

export class NetworkException extends AppException {
  constructor(
    message = 'No internet connection',
    options: AppExceptionOptions = {},
  ) {
    super(message, options);
  }
}

export class ServerException extends AppException {
  constructor(
    message = 'Server error',
    options: AppExceptionOptions = {},
  ) {
    super(message, options);
  }
}

export class TimeoutException extends NetworkException {
  constructor(
    message = 'Request timed out',
    options: AppExceptionOptions = {},
  ) {
    super(message, options);
  }
}

export class AuthException extends AppException {
  constructor(
    message = 'Authentication error',
    options: AppExceptionOptions = {},
  ) {
    super(message, options);
  }
}

export class AppDatabaseException extends AppException {
  constructor(
    message = 'Database error',
    options: AppExceptionOptions = {},
  ) {
    super(message, options);
  }
}
