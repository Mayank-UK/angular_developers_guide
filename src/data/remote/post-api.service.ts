import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { guardedApiCall } from '../../core/error-handling/guards';
import { ServerException } from '../../core/error-handling/exceptions';
import { APP_CONFIG } from '../../core/di/tokens';
import type { AppConfig } from '../../core/config/app-config';
import { postDtoFromJson, type PostDTO } from './post-dto';

/**
 * PostRemoteDataSource — the contract for talking to the REST API and returning
 * DTOs. Mirrors the React/Flutter `PostRemoteDataSource`. Raw HttpClient errors
 * (HttpErrorResponse) are upgraded to typed AppExceptions by the guards
 * pipeline (`guardedApiCall` / `httpErrorToException`); the retry interceptor
 * further upstream already converts exhausted transient failures.
 *
 * Lives in `data/` — DTOs never cross into `domain/` or `ui/`.
 */
export interface PostRemoteDataSource {
  getPosts(): Promise<PostDTO[]>;
}

/**
 * PostApiService — live Angular implementation wrapping `HttpClient`.
 * Mirrors the React `JsonPlaceholderPostRemoteDataSource`.
 */
@Injectable()
export class PostApiService implements PostRemoteDataSource {
  private readonly http = inject(HttpClient);
  private readonly config: AppConfig = inject(APP_CONFIG);

  getPosts(): Promise<PostDTO[]> {
    return guardedApiCall(async () => {
      const data = await firstValueFrom(
        this.http.get<unknown>(`${this.config.apiBaseUrl}/posts`),
      );
      if (!Array.isArray(data)) {
        throw new ServerException('Expected a list of posts');
      }
      return (data as Record<string, unknown>[]).map((item) =>
        postDtoFromJson(item),
      );
    });
  }
}
