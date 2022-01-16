document.addEventListener('DOMContentLoaded', () => {
  // Get current preference settings:
  window.api.send('preferences_load');

  // Add save listener for preference window.
  document.getElementById('btn-preferences-save').addEventListener('click', () => {
    window.api.send('preferences_save', {
      theme: document.getElementById('settting-theme-select').value,
      indexes: {
        picklists: document.getElementById('index-picklsits').checked,
        lookups: document.getElementById('index-lookups').checked,
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
        supressReadOnly: document.getElementById('hide-readonly-fields').checked,
        supressAudit: document.getElementById('hide-audit-fields').checked,
      },
    });
    window.api.send('preferences_close');
  });

  // Add click to close listener for preference window.
  document.getElementById('btn-preferences-close').addEventListener('click', () => {
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
  document.getElementById('settting-theme-select').value = data.theme;
  document.getElementById('index-picklsits').checked = data.indexes.picklists;
  document.getElementById('index-lookups').checked = data.indexes.lookups;
  document.querySelector(`input[name="picklist-fieldType"][value="${data.picklists.type}"]`).checked = true;
  document.getElementById('picklist-restricted').checked = data.picklists.unrestricted;
  document.getElementById('picklist-blank').checked = data.picklists.ensureBlanks;
  document.querySelector(`input[name="lookup-fieldType"][value="${data.lookups.type}"]`).checked = true;
  document.getElementById('default-value').checked = data.defaults.attemptSFValues;
  document.getElementById('default-blank').checked = data.defaults.textEmptyString;
  document.getElementById('hide-readonly-fields').checked = data.defaults.supressReadOnly;
  document.getElementById('hide-audit-fields').checked = data.defaults.supressAudit;
});
