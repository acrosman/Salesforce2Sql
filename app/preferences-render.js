document.addEventListener('DOMContentLoaded', () => {
  // Add save listener for preference window.
  document.getElementById('btn-preferences-save').addEventListener('click', () => {
    window.api.send('preferences_save', {
      theme: document.getElementById('settting-theme-select').value,
    });
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
  document.getElementById('settting-theme-select').value = data.theme;
});
