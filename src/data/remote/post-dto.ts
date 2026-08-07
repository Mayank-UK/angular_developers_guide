import type { Post } from '../../domain/models/post';

/**
 * PostDTO — the wire/transport shape of a post, as returned by the REST API and
 * stored in the local cache. Responsible for (de)serialization and for mapping
 * to/from the domain `Post`. Mirrors the React/Flutter `PostDTO`.
 *
 * In TypeScript this is a plain interface plus pure conversion helpers; there is
 * no runtime class needed (unlike Dart) because types are erased at runtime.
 *
 * DTOs never leave the `data/` layer — views import the domain `Post`, never
 * `PostDTO`.
 */
export interface PostDTO {
  id: number;
  title: string;
  body: string;
}

/**
 * Deserialize a JSON object (from the API or IndexedDB) into a PostDTO.
 *
 * Validates the payload rather than coercing: a malformed post (non-numeric id,
 * non-string title/body, NaN, etc.) throws, so bad server data or cache
 * corruption surfaces as a typed exception (ServerException from the remote
 * source via guardedApiCall; AppDatabaseException from the DAO's catch) instead
 * of propagating `NaN` ids or "[object Object]" titles into the UI.
 */
export function postDtoFromJson(json: Record<string, unknown>): PostDTO {
  const { id, title, body } = json;

  if (typeof id !== 'number' || !Number.isInteger(id)) {
    throw new Error(
      `Invalid post: id must be an integer, got ${describe(id)}`,
    );
  }
  if (typeof title !== 'string') {
    throw new Error(`Invalid post ${id}: title must be a string, got ${describe(title)}`);
  }
  if (typeof body !== 'string') {
    throw new Error(`Invalid post ${id}: body must be a string, got ${describe(body)}`);
  }

  return { id, title, body };
}

/** Human-readable type name for a validation error message. */
function describe(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  return typeof value;
}

/** Serialize a PostDTO to a plain JSON object (for IndexedDB persistence). */
export function postDtoToJson(dto: PostDTO): Record<string, unknown> {
  return { id: dto.id, title: dto.title, body: dto.body };
}

/** Convert a transport DTO into a domain model. */
export function dtoToPost(dto: PostDTO): Post {
  return { id: dto.id, title: dto.title, body: dto.body };
}

/** Convert a domain model into a transport DTO. */
export function fromPost(post: Post): PostDTO {
  return { id: post.id, title: post.title, body: post.body };
}
