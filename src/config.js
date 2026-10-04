// Default local port for the OAuth callback server. Matches ElectronForce so a
// single External Client App can serve both tools.
const DEFAULT_CALLBACK_PORT = 3835;

/**
 * Normalizes a callback port value, falling back to the default when invalid.
 * @param {*} port The requested port.
 * @returns {number} A valid TCP port number.
 */
const normalizeCallbackPort = (port) => {
  const parsed = Number.parseInt(port, 10);
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed;
  }
  return DEFAULT_CALLBACK_PORT;
};

const config = {
  oauth: {
    clientId: process.env.SALESFORCE_CLIENT_ID || '',
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
    callbackPort: DEFAULT_CALLBACK_PORT,
    scopes: ['api', 'id', 'refresh_token'],
  },
  updateOAuthCredentials(clientId, clientSecret) {
    this.oauth.clientId = clientId;
    this.oauth.clientSecret = clientSecret;
  },
  updateOAuthCallbackPort(port) {
    this.oauth.callbackPort = normalizeCallbackPort(port);
  },
};

module.exports = config;
module.exports.DEFAULT_CALLBACK_PORT = DEFAULT_CALLBACK_PORT;
module.exports.normalizeCallbackPort = normalizeCallbackPort;
