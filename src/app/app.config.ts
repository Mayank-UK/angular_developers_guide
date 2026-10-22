import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { createAppConfig } from '../core/config';
import { provideData } from '../data/providers';
import { retryInterceptor } from '../data/remote/retry.interceptor';
// Teaching demo for the state-management / NgRx screen. Registered app-wide so
// `inject(Store)` works anywhere; INERT until an action dispatches, so it does
// not disturb the other screens. See src/app/views/state_management/ngrx/.
import { todosReducer } from './views/state_management/ngrx/todos-feature/todos.reducer';
import { TodosEffects } from './views/state_management/ngrx/todos-feature/todos.effects';
// Teaching demo for the state-management / NgRx SignalStore screen. A
// signalStore class is an @Injectable, so listing it in providers registers a
// ROOT SINGLETON (the v21 form of the older `provideState(TodosStore)` helper);
// `inject(TodosStore)` works anywhere. It is INERT until a method is called, so
// it does not disturb the other screens. See
// src/app/views/state_management/signal_store/.
import { TodosStore } from './views/state_management/signal_store/todos-store/todos.store';

/**
 * The global NgRx store. One feature today (`todos`); add more as the app
 * grows. Disabled in non-production builds via provideStoreDevtools so the
 * time-travel / action-log panel is available while developing.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Preload every lazy route's chunk in the background after startup so
    // section clicks resolve instantly on warm visits (chunks are small,
    // 40–162 kB). No guards/canMatch exist on the route table, so preloading
    // is side-effect free.
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([retryInterceptor])),
    provideData(createAppConfig(environment)),
    provideStore({ todos: todosReducer }),
    provideEffects([TodosEffects]),
    provideStoreDevtools({
      maxAge: 25, // retain the last 25 dispatched actions for time-travel
      logOnly: environment.production,
    }),
    // NgRx SignalStore (todos teaching demo) — root singleton.
    TodosStore,
  ],
};
