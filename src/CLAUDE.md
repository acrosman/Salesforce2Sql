# Main-process modules (`src/`)

## IPC handlers

- Every key of the `handlers` object exported by `sf_calls.js` is registered as an `ipcMain.on` channel in `main.js`. Adding a handler there exposes it automatically, but the renderer can only call it once the channel is added to the `send` allowlist in `app/preload.js`.
- Handlers reply through `mainWindow.webContents.send(...)`, never through return values. The window is injected with `setwindow()` and preferences with `setPreferences()`. Any new response channel must be added to the `receive` allowlist in `app/preload.js`.
- Use `logMessage(title, channel, message)` to show messages in the renderer log, and `updateLoader(message)` for progress updates.
- Preferences channels (`preferences_load`, `preferences_save`, `preferences_close`) are wired directly in `main.js` and allowlisted in `app/preferencesPreload.js`.

## Salesforce and schema

- Login supports two modes: username/password (`sfPasswordLogin`) and OAuth (`sfOAuthLogin` → `sf_oauth.attemptLogin`). The OAuth flow opens the system browser and receives the code on `http://localhost:<port>/callback`. The default port is 3835, shared with ElectronForce so one External Client App works for both.
- Salesforce field types map to Knex column builders through `typeResolverBases` in `constants.js`, not directly to SQL types. `buildFields` filters fields (read-only and audit suppression), and `buildTable` applies the types along with the preference-driven rules for picklists, lookups, indexes, and defaults.
- `standardObjectsByFeature`, `indicatorObjects`, and `indicatorNamespaces` in `constants.js` drive org-type sniffing and object recommendations.

## Tests (`src/tests/`)

- `.babelrc` enables `babel-plugin-rewire`, so tests reach module-private functions and state with `module.__get__('name')` and `module.__set__(...)`. Prefer that to exporting internals just for tests.
- `src/tests/__mocks__/` holds manual mocks for `electron`, `jsforce`, and `knex`. Extend those mocks rather than stubbing inline when a module needs more of an API.
- `sampleSObjectDescribes.json` is the fixture for describe results and schema loading.
