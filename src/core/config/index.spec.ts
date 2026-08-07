import { createAppConfig } from './index';
import { EnvironmentName, type Environment } from './app-config';

function env(overrides: Partial<Environment> = {}): Environment {
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

describe('createAppConfig', () => {
  it('copies the scalar fields through to AppConfig', () => {
    const c = createAppConfig(
      env({
        production: true,
        name: EnvironmentName.Prod,
        apiBaseUrl: 'https://api.example.test',
      }),
    );
    expect(c.production).toBe(true);
    expect(c.name).toBe(EnvironmentName.Prod);
    expect(c.apiBaseUrl).toBe('https://api.example.test');
  });

  it('preserves the wiring slot values', () => {
    const c = createAppConfig(
      env({ wiring: { remote: 'live', db: 'live' } }),
    );
    expect(c.wiring).toEqual({ remote: 'live', db: 'live' });
  });

  it('preserves the scenario toggles', () => {
    const c = createAppConfig(
      env({
        scenario: {
          injectNetworkFailure: true,
          injectTimeout: true,
          injectServerFailure: false,
          injectDbFailure: true,
        },
      }),
    );
    expect(c.scenario).toEqual({
      injectNetworkFailure: true,
      injectTimeout: true,
      injectServerFailure: false,
      injectDbFailure: true,
    });
  });

  it('defensively copies scenario so callers cannot mutate the config', () => {
    const source = env();
    const c = createAppConfig(source);
    source.scenario.injectNetworkFailure = true;
    expect(c.scenario.injectNetworkFailure).toBe(false);
  });
});
