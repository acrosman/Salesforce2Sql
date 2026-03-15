# Salesforce2Sql — Copilot Instructions

## Project

Electron desktop app that connects to a Salesforce org and generates a SQL schema (MySQL, PostgreSQL, or SQLite) from its object/field definitions.

## Structure

| Path                        | Role                                                           |
| --------------------------- | -------------------------------------------------------------- |
| `main.js`                   | Main process: window lifecycle and IPC routing                 |
| `app/render.js`             | Dashboard renderer: schema generation UI                       |
| `app/preferences-render.js` | Preferences renderer: settings UI                              |
| `src/sf_calls.js`           | Salesforce API calls, field-type resolution, schema generation |
| `src/constants.js`          | Field-type→SQL mappings, standard object lists, audit fields   |
| `src/preferences.js`        | Read/write `preferences.json` user settings                    |
| `src/menu.js`               | Application menu template                                      |
| `src/find.js`               | In-window content search                                       |
| `src/tests/`, `app/tests/`  | Jest unit tests                                                |

## Coding Style

Follow the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript). The project uses `eslint-config-airbnb-base`. Run the linter before committing any code:

```sh
npm run lint   # eslint src app --ignore-path .gitignore
```

To auto fix linting errors, run:

```sh
npm run lint:fix   #eslint src app --ignore-path .gitignore --fix`
```

## Testing

Use VS Code's built-in test runner (Jest integration) to run tests. Test files live in `src/tests/` and `app/tests/`.
