import { inject, Injectable } from '@angular/core';
import { ScenarioService } from '../../core/scenario/scenario.service';
import {
  NetworkException,
  ServerException,
  TimeoutException,
} from '../../core/error-handling/exceptions';
import type { PostRemoteDataSource } from '../remote/post-api.service';
import type { PostDTO } from '../remote/post-dto';

/**
 * FakeApiService — a dev-only stand-in for the live remote data source.
 * Mirrors the React/Flutter guide's `FakeApiService`. Until a backend exists
 * (or to exercise failure paths), this returns canned data after a small delay
 * and throws typed AppExceptions based on the live scenario toggles held by
 * `ScenarioService` (which the Exception-handling screen can flip at runtime).
 */
@Injectable()
export class FakeApiService implements PostRemoteDataSource {
  private readonly scenario = inject(ScenarioService);

  private readonly posts: PostDTO[] = [
    { id: 1, title: 'Fake post', body: 'From fake API' },
    {
      id: 2,
      title: 'Clean architecture in Angular',
      body: 'Domain → Data → UI, with use cases and repositories.',
    },
    {
      id: 3,
      title: 'Error pipeline',
      body: 'Exceptions become Failures; severity drives the UI.',
    },
  ];

  getPosts(): Promise<PostDTO[]> {
    return this.simulate(() => [...this.posts]);
  }

  private async simulate<T>(onSuccess: () => T): Promise<T> {
    await delay(600);
    // Priority matches ScenarioService.apiScenario(): timeout > network > server.
    if (this.scenario.shouldInjectTimeout()) {
      throw new TimeoutException('Simulated request timed out');
    }
    if (this.scenario.shouldInjectNetworkFailure()) {
      throw new NetworkException('Simulated no internet connection');
    }
    if (this.scenario.shouldInjectServerFailure()) {
      throw new ServerException('Simulated server returned 500');
    }
    return onSuccess();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
