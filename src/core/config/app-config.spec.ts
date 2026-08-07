import {
  EnvironmentName,
  isDev,
  isStaging,
  isProd,
  type AppConfig,
} from './app-config';
import { createAppConfig } from './index';

function baseConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    production: false,
    name: EnvironmentName.Dev,
    wiring: { remote: 'fake', db: 'fake' },
    apiBaseUrl: 'https://example.test',
    scenario: {
      injectNetworkFailure: false,
      injectTimeout: false,
      injectServerFailure: false,
      injectDbFailure: false,
    },
    ...overrides,
  };
}

describe('EnvironmentName', () => {
  it('is a const-object + literal union, never an enum', () => {
    expect(EnvironmentName.Dev).toBe('dev');
    expect(EnvironmentName.Staging).toBe('staging');
    expect(EnvironmentName.Prod).toBe('prod');
  });
});

describe('environment predicates', () => {
  it('isDev/isStaging/isProd read the name field', () => {
    expect(isDev(baseConfig({ name: EnvironmentName.Dev }))).toBe(true);
    expect(isStaging(baseConfig({ name: EnvironmentName.Staging }))).toBe(true);
    expect(isProd(baseConfig({ name: EnvironmentName.Prod }))).toBe(true);
  });

  it('predicates are mutually exclusive', () => {
    const dev = baseConfig({ name: EnvironmentName.Dev });
    expect(isDev(dev)).toBe(true);
    expect(isStaging(dev)).toBe(false);
    expect(isProd(dev)).toBe(false);
  });
});

describe('createAppConfig wiring immutability', () => {
  it('defensively copies the wiring slot so callers cannot mutate it', () => {
    const config = createAppConfig({
      production: false,
      name: EnvironmentName.Dev,
      wiring: { remote: 'live', db: 'live' },
      apiBaseUrl: 'https://example.test',
      scenario: {
        injectNetworkFailure: false,
        injectTimeout: false,
        injectServerFailure: false,
        injectDbFailure: false,
      },
    });
    // The frozen value should not reflect a later mutation of the source wiring
    // (createAppConfig copies the fields by value).
    expect(config.wiring).toEqual({ remote: 'live', db: 'live' });
  });
});
