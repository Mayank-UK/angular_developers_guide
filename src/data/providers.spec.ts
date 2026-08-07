import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  APP_CONFIG,
  GET_POSTS_USE_CASE,
  POST_REPOSITORY,
} from '../core/di/tokens';
import { createAppConfig } from '../core/config';
import { EnvironmentName, type AppConfig } from '../core/config/app-config';
import { ScenarioService } from '../core/scenario/scenario.service';
import { GetPostsUseCase } from '../domain/usecases/get-posts-usecase';
import { provideData, getWiring } from './providers';
import { FakeApiService } from './fake/fake-api-service';
import { FakeAppDatabase } from './fake/fake-app-database';
import { PostApiService } from './remote/post-api.service';
import { AppDatabaseImpl } from './local/app-database';
import { PostRepositoryImpl } from './repositories/post-repository-impl';
import { FailureScenario } from '../core/scenario/failure-scenario';

function makeConfig(
  wiring: { remote: 'fake' | 'live'; db: 'fake' | 'live' },
): AppConfig {
  return createAppConfig({
    production: false,
    name: EnvironmentName.Dev,
    wiring,
    apiBaseUrl: 'https://example.test',
    scenario: {
      injectNetworkFailure: false,
      injectTimeout: false,
      injectServerFailure: false,
      injectDbFailure: false,
    },
  });
}

describe('getWiring', () => {
  it('mirrors the config wiring slot', () => {
    expect(getWiring(makeConfig({ remote: 'fake', db: 'fake' }))).toEqual({
      remote: 'fake',
      db: 'fake',
    });
    expect(getWiring(makeConfig({ remote: 'live', db: 'live' }))).toEqual({
      remote: 'live',
      db: 'live',
    });
  });
});

describe('provideData (fake wiring)', () => {
  async function setup() {
    const config = makeConfig({ remote: 'fake', db: 'fake' });
    await TestBed.configureTestingModule({
      providers: [provideData(config)],
    }).compileComponents();
    return config;
  }

  it('provides APP_CONFIG, POST_REPOSITORY and GET_POSTS_USE_CASE', async () => {
    await setup();
    expect(TestBed.inject(APP_CONFIG)).toBeDefined();
    expect(TestBed.inject(POST_REPOSITORY)).toBeInstanceOf(PostRepositoryImpl);
    expect(TestBed.inject(GET_POSTS_USE_CASE)).toBeInstanceOf(GetPostsUseCase);
  });

  it('wires the fake remote + fake db for the fake slot', async () => {
    await setup();
    // The fake sources are registered as themselves and should be injectable.
    expect(TestBed.inject(FakeApiService)).toBeInstanceOf(FakeApiService);
    expect(TestBed.inject(FakeAppDatabase)).toBeInstanceOf(FakeAppDatabase);
    // The live sources are NOT registered in fake mode.
    expect(() => TestBed.inject(PostApiService)).toThrow();
    expect(() => TestBed.inject(AppDatabaseImpl)).toThrow();
  });
});

describe('provideData (live wiring)', () => {
  it('wires the live remote + live db and falls back when fakes absent', async () => {
    const config = makeConfig({ remote: 'live', db: 'live' });
    await TestBed.configureTestingModule({
      providers: [provideData(config), provideHttpClient()],
    }).compileComponents();

    expect(TestBed.inject(PostApiService)).toBeInstanceOf(PostApiService);
    expect(TestBed.inject(AppDatabaseImpl)).toBeInstanceOf(AppDatabaseImpl);
    expect(TestBed.inject(POST_REPOSITORY)).toBeInstanceOf(PostRepositoryImpl);
  });
});

describe('ScenarioService', () => {
  it('seeds toggles from APP_CONFIG and supports runtime flips', async () => {
    const config = makeConfig({ remote: 'fake', db: 'fake' });
    config.scenario.injectNetworkFailure = true;
    await TestBed.configureTestingModule({
      providers: [provideData(config)],
    }).compileComponents();

    const s = TestBed.inject(ScenarioService);
    expect(s.shouldInjectNetworkFailure()).toBe(true);
    expect(s.apiScenario()).toBe(FailureScenario.NetworkFailure);

    s.injectNetworkFailure.set(false);
    s.injectTimeout.set(true);
    // timeout has priority over network/server
    expect(s.apiScenario()).toBe(FailureScenario.Timeout);

    s.reset();
    expect(s.shouldInjectNetworkFailure()).toBe(true);
    expect(s.shouldInjectTimeout()).toBe(false);
  });

  it('reports None when no api toggle is set', async () => {
    const config = makeConfig({ remote: 'fake', db: 'fake' });
    await TestBed.configureTestingModule({
      providers: [provideData(config)],
    }).compileComponents();
    expect(TestBed.inject(ScenarioService).apiScenario()).toBe(
      FailureScenario.None,
    );
  });
});
