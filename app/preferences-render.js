document.addEventListener('DOMContentLoaded', () => {
  // Get current preference settings:
  window.api.send('preferences_load');

  // Add save listener for preference window.
  document.getElementById('btn-preferences-save').addEventListener('click', (event) => {
    event.preventDefault();
    window.api.send('preferences_save', {
      theme: document.getElementById('setting-theme-select').value,
      indexes: {
        externalIds: document.getElementById('index-externalIds').checked,
        lookups: document.getElementById('index-lookups').checked,
        picklists: document.getElementById('index-picklists').checked,
      },
      picklists: {
        type: document.querySelector('input[name="picklist-fieldType"]:checked').value,
        unrestricted: document.getElementById('picklist-restricted').checked,
        ensureBlanks: document.getElementById('picklist-blank').checked,
      },
      lookups: {
        type: document.querySelector('input[name="lookup-fieldType"]:checked').value,
      },
      defaults: {
        attemptSFValues: document.getElementById('default-value').checked,
        textEmptyString: document.getElementById('default-blank').checked,
        checkboxDefaultFalse: document.getElementById('default-checkbox').checked,
        suppressReadOnly: document.getElementById('hide-readonly-fields').checked,
        suppressAudit: document.getElementById('hide-audit-fields').checked,
      },
      oauth: {
        clientId: document.getElementById('oauth-client-id').value,
        clientSecret: document.getElementById('oauth-client-secret').value,
        clearCredentials: document.getElementById('oauth-clear-credentials').checked,
        callbackPort: document.getElementById('oauth-callback-port').value,
      },
    });
    window.api.send('preferences_close');
  });

  // Keep the Callback URL hint in sync with the port.
  document.getElementById('oauth-callback-port').addEventListener('input', (event) => {
    document.getElementById('oauth-callback-port-display').innerText = event.target.value;
  });

  // Add click to close listener for preference window.
  document.getElementById('btn-preferences-close').addEventListener('click', (event) => {
    event.preventDefault();
    window.api.send('preferences_close');
  });

  // Add escape key listener for closing window.
  document.onkeyup = (evt) => {
    const event = evt || window.event;
    let isEscape = false;
    if ('key' in evt) {
      isEscape = (event.key === 'Escape' || event.key === 'Esc');
    }
    if (isEscape) {
      window.api.send('preferences_close');
    }
  };
});

window.api.receive('preferences_data', (data) => {
  // Set Window theme:
  const cssPath = `../node_modules/bootswatch/dist/${data.theme.toLowerCase()}/bootstrap.min.css`;
  document.getElementById('css-theme-link').href = cssPath;

  // Set Values:
  document.getElementById('setting-theme-select').value = data.theme;
  document.getElementById('index-picklists').checked = data.indexes.picklists;
  document.getElementById('index-lookups').checked = data.indexes.lookups;
  document.getElementById('index-externalIds').checked = data.indexes.externalIds;
  document.querySelector(`input[name="picklist-fieldType"][value="${data.picklists.type}"]`).checked = true;
  document.getElementById('picklist-restricted').checked = data.picklists.unrestricted;
  document.getElementById('picklist-blank').checked = data.picklists.ensureBlanks;
  document.querySelector(`input[name="lookup-fieldType"][value="${data.lookups.type}"]`).checked = true;
  document.getElementById('default-value').checked = data.defaults.attemptSFValues;
  document.getElementById('default-blank').checked = data.defaults.textEmptyString;
  document.getElementById('default-checkbox').checked = data.defaults.checkboxDefaultFalse;
  document.getElementById('hide-readonly-fields').checked = data.defaults.suppressReadOnly;
  document.getElementById('hide-audit-fields').checked = data.defaults.suppressAudit;
  // Saved credentials are never sent here, so the keychain isn't touched just
  // to open Preferences. Blank fields keep the saved values.
  const hasCredentials = Boolean(data.oauth?.hasCredentials);
  document.getElementById('oauth-client-id').value = '';
  document.getElementById('oauth-client-secret').value = '';
  document.getElementById('oauth-clear-credentials').checked = false;
  document.getElementById('oauth-clear-credentials').disabled = !hasCredentials;
  document.getElementById('oauth-client-id').placeholder = hasCredentials
    ? 'Saved. Leave blank to keep the current client ID.'
    : 'Enter External Client App consumer key';
  document.getElementById('oauth-client-secret').placeholder = hasCredentials
    ? 'Saved. Leave blank to keep the current secret.'
    : 'Enter External Client App consumer secret';
  document.getElementById('oauth-credential-status').innerText = hasCredentials
    ? 'OAuth credentials are saved and stored encrypted.'
    : 'No OAuth credentials saved yet.';
  document.getElementById('oauth-callback-port').value = data.oauth?.callbackPort || 3835;
  document.getElementById('oauth-callback-port-display').innerText = data.oauth?.callbackPort || 3835;
});
