# Renderer (`app/`)

- Renderers have no Node access. They talk to the main process only through `window.api.send(channel, data)` and `window.api.receive(channel, fn)`, which the preload scripts expose with `contextBridge`.
- The preload scripts allowlist every channel. When you add an IPC message, update `preload.js` (main window) or `preferencesPreload.js` (Preferences window) in both directions as needed, or the message is silently dropped.
- The UI uses jQuery and Bootstrap 5 with Bootswatch themes. The theme is a user preference.

## Tests (`app/tests/`)

- Renderer tests run under the jsdom environment (`@jest-environment jsdom` docblock).
- `render.test.js` loads `app/tests/minIndex.html` into `document.body` before each test, mocks `window.api.send`/`receive` with `jest.fn()`, and stubs jQuery plugins (`jsonViewer`, `tab`). If `render.js` starts depending on new markup, add it to `minIndex.html`.
