import { InjectionToken } from '@angular/core';
import type { AppConfig } from '../config/app-config';
import type { PostRepository } from '../../domain/repositories/post-repository';
import type { GetPostsUseCase } from '../../domain/usecases/get-posts-usecase';

/**
 * Angular InjectionTokens — the DI seam. The React guide hand-rolls a service
 * locator (`container.ts`); Angular has a native DI system, so the contracts
 * the domain defines are exposed to injection via these tokens.
 *
 * `core/` may import `@angular/core`; `domain/` must stay framework-free, so
 * these tokens reference the domain contracts via **type-only** imports (no
 * runtime coupling — domain never depends on Angular).
 */
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

export const POST_REPOSITORY = new InjectionToken<PostRepository>(
  'POST_REPOSITORY',
);

export const GET_POSTS_USE_CASE = new InjectionToken<GetPostsUseCase>(
  'GET_POSTS_USE_CASE',
);
