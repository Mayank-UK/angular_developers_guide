/**
 * stringify — reduce an unknown caught value to a human-readable message.
 *
 * Shared by data-layer catches (e.g. `PostDAO`) and UI demos that surface a
 * thrown error's message. Pure: no side effects, no framework dependency, so it
 * belongs in `core/error-handling/` (the folder shared across layers). Kept as
 * a standalone module so both `data/` and `ui/` can import it without pulling
 * in the heavier `guards.ts` (which imports HttpClient types).
 *
 * @param e any thrown value.
 * @returns the `Error.message` if `e` is an Error, else `String(e)`.
 */
export function stringify(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
