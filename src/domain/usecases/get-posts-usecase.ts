import type { Post } from '../models/post';
import type { Result } from '../../core/result';
import type { PostRepository } from '../repositories/post-repository';

/**
 * GetPostsUseCase — a thin orchestration layer over the repository. Mirrors the
 * React/Flutter `GetPostsUseCase`.
 *
 * The value is the *seam*: use cases are where cross-cutting policy (logging,
 * caching policy, combining multiple repositories, business rules) lives,
 * keeping repositories focused on a single source. Here it's a one-liner, but
 * the boundary matters. Framework-free.
 */
export class GetPostsUseCase {
  private readonly repository: PostRepository;

  constructor(repository: PostRepository) {
    this.repository = repository;
  }

  execute(): Promise<Result<Post[]>> {
    return this.repository.getPosts();
  }
}
