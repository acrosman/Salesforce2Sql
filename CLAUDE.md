# Salesforce2Sql

Electron desktop app that connects to a Salesforce org, reads its object and field definitions, and generates a matching database schema with [Knex](https://knexjs.org/). It can build the tables directly in MySQL, PostgreSQL, or SQLite, or write the DDL out to a `.sql` file.

Directory-specific guidance lives in [src/CLAUDE.md](src/CLAUDE.md) (main process) and [app/CLAUDE.md](app/CLAUDE.md) (renderer).

Do not attempt to edit files outside this project. Do not seek full disk access for any reason.

## Structure

| Path                        | Role                                                                          |
| --------------------------- | ----------------------------------------------------------------------------- |
| `main.js`                   | Main process: window lifecycle, security hardening, IPC routing               |
| `app/render.js`             | Dashboard renderer: login, object selection, schema generation UI             |
| `app/preferences-render.js` | Preferences window renderer                                                   |
| `app/preload.js`            | `window.api` bridge and IPC channel allowlist for the main window             |
| `app/preferencesPreload.js` | `window.api` bridge and IPC channel allowlist for the Preferences window      |
| `src/sf_calls.js`           | IPC handlers: Salesforce login/describe, field-type resolution, Knex DB build |
| `src/sf_oauth.js`           | OAuth web server flow (PKCE) with a local callback server                     |
| `src/constants.js`          | Salesforce→Knex type map, standard objects by feature, audit fields           |
| `src/preferences.js`        | Preferences window and `preferences.json`; OAuth credentials via safeStorage  |
| `src/menu.js`               | Application menu template                                                     |
| `src/find.js`               | In-window text search                                                         |
| `src/tests/`, `app/tests/`  | Jest unit tests                                                               |
| `forge.config.js`           | Electron Forge packaging and publishing                                       |

## Commands

```sh
npm start            # Run the app (electron-forge start)
npm test             # Jest with coverage (what CI runs, on Node 22 and 24)
npm run lint         # eslint src app --ignore-path .gitignore
npm run lint:fix     # Same, with --fix
npx jest src/tests/sf_calls.test.js -t "test name"   # One file or test
```

The Husky pre-commit hook runs `npm run lint` and `npm run test-on-commit` (plain `jest`), so a commit fails if either fails.

## Coding Style

Follow the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript). ESLint extends `airbnb-base` with a few overrides in `.eslintrc.js`. Run `npm run lint` before committing. Note that it only covers `src/` and `app/`, so `main.js` is not linted.

Write JSDoc comments on functions, matching the existing code.

## Security

- The windows run with `contextIsolation: true` and `nodeIntegration: false`. Navigation, new windows, and permission requests are blocked in `main.js`. Keep it that way.
- OAuth client credentials never go into `preferences.json`. They are encrypted with Electron `safeStorage` into `oauth-preferences.bin` in the user data directory. If encryption is unavailable they are kept in memory for the session only. `SALESFORCE_CLIENT_ID` and `SALESFORCE_CLIENT_SECRET` environment variables override stored values.
- Decrypting credentials can trigger an OS keychain prompt, so they are loaded only when a login starts (see `setCredentialProvider` in `src/sf_oauth.js`). Status checks only test whether the file exists.
- Do not commit real OAuth secrets, and do not share Consumer Secrets in screenshots or issue comments.
- Use a sandbox External Client App for development whenever possible.

## Testing

Tests use Jest 27 and live in `src/tests/` and `app/tests/`. VS Code's Jest integration and the "Jest Tests" launch configuration both work, as do the npm commands above. See the directory CLAUDE.md files for the mocking and test setup conventions.
