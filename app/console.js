/* eslint no-console: 0 */
function displayMessage(sender, channel, message) {
  console.log(`From ${sender}, on ${channel} got ${message}`);

  // Create elements for display
  const row = document.createElement('div');
  const mesContext = document.createElement('div');
  const mesText = document.createElement('div');

  // Add Classes
  row.setAttribute('class', 'row pre-scrollable');
  mesContext.setAttribute('class', 'col-md-2');
  mesText.setAttribute('class', 'col-md-10');

  // Add Text
  mesContext.innerHTML = `Sender: ${sender} <br>Channel: ${channel}`;
  mesText.innerHTML = message;

  // Attach Elements
  row.appendChild(mesContext);
  row.appendChild(mesText);
  document.getElementById('message-wrapper').appendChild(row);
}

// Handle API message
window.api.receive('log_message', (data) => {
  displayMessage(data.sender, data.channel, data.message);
});
