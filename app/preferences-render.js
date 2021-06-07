document.addEventListener('DOMContentLoaded', () => {
  // Add click to close listener for preference window.
  document.getElementById('btn-preferences-close').addEventListener('click', () => {
    window.close();
  });

  // Add escape key listener for closing window.
  document.onkeyup = (evt) => {
    const event = evt || window.event;
    let isEscape = false;
    if ('key' in evt) {
      isEscape = (event.key === 'Escape' || event.key === 'Esc');
    }
    if (isEscape) {
      window.close();
    }
  };
});
